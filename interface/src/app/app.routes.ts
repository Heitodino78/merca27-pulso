import { Routes } from '@angular/router';
import { EntradaPagina } from './paginas/entrada';
import { FornecedoresPagina } from './paginas/fornecedores';
import { NaoEncontradaPagina } from './paginas/nao-encontrada';
import { ProdutoDetalhePagina } from './paginas/produto-detalhe';
import { ProdutoNovoPagina } from './paginas/produto-novo';
import { ProdutosPagina } from './paginas/produtos';
import { ReposicaoPagina } from './paginas/reposicao';

/* Rotas carregadas de forma imediata: lazy loading geraria chunks fora do HTML único. */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'produtos' },
  { path: 'produtos', component: ProdutosPagina, title: 'Produtos — PULSO' },
  { path: 'produtos/novo', component: ProdutoNovoPagina, title: 'Novo produto — PULSO' },
  { path: 'produtos/:sku', component: ProdutoDetalhePagina, title: 'Produto — PULSO' },
  { path: 'entrada', component: EntradaPagina, title: 'Registrar entrada — PULSO' },
  { path: 'reposicao', component: ReposicaoPagina, title: 'Reposição sugerida — PULSO' },
  { path: 'fornecedores', component: FornecedoresPagina, title: 'Fornecedores — PULSO' },
  { path: '**', component: NaoEncontradaPagina, title: 'Página não encontrada — PULSO' },
];
