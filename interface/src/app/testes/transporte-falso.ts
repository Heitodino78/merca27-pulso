import type { AcaoPulso } from '../nucleo/contratos';
import type { TransportePulso } from '../nucleo/transporte';

export interface ChamadaFalsa {
  acao: AcaoPulso;
  pedido: Record<string, unknown> | undefined;
  responder(valor: unknown): void;
  falhar(erro: Error): void;
}

/** Transporte controlado pelo teste: cada chamada fica pendente até ser respondida. */
export class TransporteFalso implements TransportePulso {
  readonly chamadas: ChamadaFalsa[] = [];
  /** Respostas automáticas por ação (consultas), para não precisar responder uma a uma. */
  readonly automaticas = new Map<AcaoPulso, unknown>();

  chamar(acao: AcaoPulso, pedido?: object): Promise<unknown> {
    if (this.automaticas.has(acao)) return Promise.resolve(structuredClone(this.automaticas.get(acao)));
    return new Promise((responder, falhar) => {
      this.chamadas.push({ acao, pedido: pedido as Record<string, unknown> | undefined, responder, falhar });
    });
  }

  daAcao(acao: AcaoPulso): ChamadaFalsa[] {
    return this.chamadas.filter((c) => c.acao === acao);
  }
}

export const PRODUTOS = [
  { sku: 'MER-001', nome: 'Água Mineral Fictícia 500 ml', categoria: 'BEBIDAS', precoVendaCentavos: 200, custoRefCentavos: 160, fornecedorId: 'FOR-001', atualizadoEm: '2026-11-18T12:00:00.000Z', ativo: true, saldoAtual: 3, estoqueMinimo: 4, estoqueAlvo: 11 },
  { sku: 'MER-002', nome: 'Arroz Demonstração 1 kg', categoria: 'MERCEARIA', precoVendaCentavos: 754, custoRefCentavos: 580, fornecedorId: 'FOR-002', atualizadoEm: '2026-11-18T12:00:00.000Z', ativo: false, saldoAtual: 20, estoqueMinimo: 5, estoqueAlvo: 11 },
];

export const FORNECEDORES = [
  { fornecedor_id: 'FOR-001', nome_ficticio: 'Distribuidora Fictícia Um', categoria_principal: 'BEBIDAS', prazo_estimado_dias: 2, ativo: true, criado_em: '2026-11-18T12:00:00.000Z', operacao_id: 'OPR-F1' },
  { fornecedor_id: 'FOR-002', nome_ficticio: 'Atacado Fictício Dois', categoria_principal: 'MERCEARIA', prazo_estimado_dias: 3, ativo: true, criado_em: '2026-11-18T12:00:00.000Z', operacao_id: 'OPR-F2' },
];

/** Espera microtarefas e a renderização do Angular sem zone.js. */
export async function estabilizar(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();
  }
}
