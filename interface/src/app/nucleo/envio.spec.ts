import type { ErroPulso, RespostaGravacao } from './contratos';
import { ControleEnvio, gerarRequisicaoId } from './envio';
import type { ResultadoGravacao } from './pulso-api';

type Pedido = { sku: string; quantidade: number };
type Chamada = Pedido & { requisicaoId: string };

function adiado<T>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((r) => (resolver = r));
  return { promessa, resolver };
}

const ok = (mensagem = 'Entrada registrada.'): ResultadoGravacao<RespostaGravacao> => ({ ok: true, valor: { operacaoId: 'OPR-1', mensagem } });
const falha = (codigo: string, certeza: 'nada-gravado' | 'incerto' | 'conflito' | 'pendente'): ResultadoGravacao<RespostaGravacao> =>
  ({ ok: false, erro: { codigo, mensagem: codigo } as ErroPulso, certeza });

function criar(respostas: ResultadoGravacao<RespostaGravacao>[]) {
  const chamadas: Chamada[] = [];
  let ids = 0;
  const controle = new ControleEnvio<Pedido, RespostaGravacao>(async (p) => {
    chamadas.push(p);
    return respostas.shift() ?? ok();
  }, () => `UI-TESTE-${++ids}`);
  return { controle, chamadas };
}

describe('ControleEnvio: chave por tentativa lógica', () => {
  it('gera chave aceita pelo padrão do núcleo', () => {
    const id = gerarRequisicaoId();
    expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/);
    expect(gerarRequisicaoId()).not.toBe(id);
  });

  it('ignora o segundo envio enquanto o primeiro está em andamento (clique duplo)', async () => {
    const pendente = adiado<ResultadoGravacao<RespostaGravacao>>();
    const chamadas: Chamada[] = [];
    const controle = new ControleEnvio<Pedido, RespostaGravacao>((p) => { chamadas.push(p); return pendente.promessa; }, () => 'UI-1');
    const primeiro = controle.enviar({ sku: 'MER-001', quantidade: 1 });
    expect(controle.enviando()).toBe(true);
    expect(await controle.enviar({ sku: 'MER-001', quantidade: 1 })).toBe(false);
    expect(await controle.repetir()).toBe(false);
    expect(chamadas.length).toBe(1);
    pendente.resolver(ok());
    expect(await primeiro).toBe(true);
    expect(controle.estado().fase).toBe('sucesso');
  });

  it('só declara sucesso depois da resposta confirmada', async () => {
    const pendente = adiado<ResultadoGravacao<RespostaGravacao>>();
    const controle = new ControleEnvio<Pedido, RespostaGravacao>(() => pendente.promessa, () => 'UI-1');
    void controle.enviar({ sku: 'MER-001', quantidade: 1 });
    expect(controle.estado().fase).toBe('enviando');
    pendente.resolver(ok());
    await pendente.promessa;
    await Promise.resolve();
    expect(controle.estado().fase).toBe('sucesso');
  });

  it('após falha incerta, repete com a MESMA chave e os MESMOS dados', async () => {
    const { controle, chamadas } = criar([falha('FALHA_COMUNICACAO', 'incerto'), ok()]);
    await controle.enviar({ sku: 'MER-001', quantidade: 10 });
    expect(controle.estado().fase).toBe('incerto');
    expect(controle.podeRepetir).toBe(true);
    await controle.repetir();
    expect(chamadas).toEqual([
      { sku: 'MER-001', quantidade: 10, requisicaoId: 'UI-TESTE-1' },
      { sku: 'MER-001', quantidade: 10, requisicaoId: 'UI-TESTE-1' },
    ]);
    expect(controle.estado().fase).toBe('sucesso');
  });

  it('dados diferentes depois de falha incerta usam a mesma chave e o conflito é apresentado', async () => {
    const { controle, chamadas } = criar([falha('FALHA_COMUNICACAO', 'incerto'), falha('REQUISICAO_CONFLITANTE', 'conflito')]);
    await controle.enviar({ sku: 'MER-001', quantidade: 10 });
    await controle.enviar({ sku: 'MER-001', quantidade: 11 });
    expect(chamadas.map((c) => c.requisicaoId)).toEqual(['UI-TESTE-1', 'UI-TESTE-1']);
    expect(controle.estado().fase).toBe('conflito');
    controle.novaTentativa();
    await controle.enviar({ sku: 'MER-001', quantidade: 11 });
    expect(chamadas[2]?.requisicaoId).toBe('UI-TESTE-2');
  });

  it('recusa antes de gravar libera a chave; o próximo envio é nova tentativa', async () => {
    const { controle, chamadas } = criar([falha('QTD_INVALIDA', 'nada-gravado'), ok()]);
    await controle.enviar({ sku: 'MER-001', quantidade: 0 });
    expect(controle.estado().fase).toBe('rejeitado');
    expect(controle.podeRepetir).toBe(false);
    await controle.enviar({ sku: 'MER-001', quantidade: 1 });
    expect(chamadas.map((c) => c.requisicaoId)).toEqual(['UI-TESTE-1', 'UI-TESTE-2']);
  });

  it('recusa depois de falha incerta NÃO descarta a chave, e repetir reenvia os dados incertos', async () => {
    const { controle, chamadas } = criar([falha('FALHA_COMUNICACAO', 'incerto'), falha('QTD_INVALIDA', 'nada-gravado'), ok()]);
    await controle.enviar({ sku: 'MER-001', quantidade: 10 });
    await controle.enviar({ sku: 'MER-001', quantidade: 0 });
    expect(controle.estado().fase).toBe('rejeitado');
    expect(controle.podeRepetir).toBe(true);
    await controle.repetir();
    expect(chamadas[2]).toEqual({ sku: 'MER-001', quantidade: 10, requisicaoId: 'UI-TESTE-1' });
  });

  it('sucesso encerra a tentativa: o próximo lançamento ganha outra chave', async () => {
    const { controle, chamadas } = criar([ok(), ok()]);
    await controle.enviar({ sku: 'MER-001', quantidade: 1 });
    await controle.enviar({ sku: 'MER-001', quantidade: 1 });
    expect(chamadas.map((c) => c.requisicaoId)).toEqual(['UI-TESTE-1', 'UI-TESTE-2']);
  });

  it('reconciliação pendente mantém a chave para repetir', async () => {
    const { controle, chamadas } = criar([falha('RECONCILIACAO_PENDENTE', 'pendente'), ok()]);
    await controle.enviar({ sku: 'MER-001', quantidade: 3 });
    expect(controle.estado().fase).toBe('pendente');
    expect(controle.podeRepetir).toBe(true);
    await controle.repetir();
    expect(chamadas[1]?.requisicaoId).toBe('UI-TESTE-1');
  });
});
