import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'pulso-nao-encontrada',
  imports: [RouterLink],
  template: `
    <h1 tabindex="-1" class="text-2xl font-extrabold">Página não encontrada</h1>
    <p class="mt-2 text-suave">O endereço não corresponde a nenhuma tela do PULSO.</p>
    <a routerLink="/produtos" class="botao-principal mt-4">Ir para produtos</a>
  `,
})
export class NaoEncontradaPagina {}
