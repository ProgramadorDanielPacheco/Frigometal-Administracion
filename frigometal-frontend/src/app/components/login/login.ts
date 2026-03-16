import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatSnackBarModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {


  credenciales = {
    correo: '',
    password: ''
  };

  cargando = false;
  constructor(
    private authService: AuthService, 
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  iniciarSesion(): void {
  if (!this.credenciales.correo || !this.credenciales.password) {
    this.snackBar.open('⚠️ Ingresa tu correo y contraseña', 'Cerrar', { duration: 3000 });
    return;
  }

  this.cargando = true;

  this.authService.iniciarSesion(this.credenciales).subscribe({
    next: (usuario) => {
      // 1. Guardar datos
      localStorage.setItem('usuarioLogueado', JSON.stringify(usuario));
      
      // 2. IMPORTANTE: Bajamos la bandera de carga
      this.cargando = false; 

      this.snackBar.open(`¡Bienvenido de vuelta, ${usuario.nombre}!`, 'Genial', { duration: 3000 });
      
      // 3. Intentamos navegar y capturamos si falla
      this.router.navigate(['/dashboard']).then(nav => {
        if (!nav) {
          console.error('❌ La navegación al Dashboard fue rechazada por el Guard.');
          this.snackBar.open('🚫 Error de acceso: El Guard bloqueó la entrada.', 'Cerrar', { duration: 5000 });
        }
      }).catch(err => {
        console.error('❌ Error crítico en el Router:', err);
      });
    },
    error: (err) => {
      this.cargando = false;
      const mensaje = err.error?.detail || 'Error de conexión al servidor';
      this.snackBar.open(`❌ ${mensaje}`, 'Cerrar', { duration: 4000 });
    }
  });

  }
}
