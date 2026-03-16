import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from './services/auth'; // <-- Importa esto
import { CommonModule } from '@angular/common'; // <-- Y esto
// Módulos de Angular Material para el diseño estructural
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, CommonModule, // <-- Agrega CommonModule aquí
    MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule, MatButtonToggleModule
  ],
  templateUrl: './app.html', // <-- Vamos a crear este archivo ahora
  styleUrls: ['./app.scss']  // <-- Y este también
})
export class App {
  title = 'Frigometal ERP';

  constructor(public authService: AuthService, private router: Router) {}

  cerrarSesion() {
    this.authService.cerrarSesion();
  }
}