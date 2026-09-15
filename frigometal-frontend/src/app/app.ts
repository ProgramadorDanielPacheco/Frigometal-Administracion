import { Component, TemplateRef, ViewChild, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from './services/auth'; 
import { CommonModule } from '@angular/common'; 
// Módulos de Angular Material para el diseño estructural
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, CommonModule, 
    MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule, MatButtonToggleModule,
    MatButtonModule, MatMenuModule,
    MatDialogModule, MatSnackBarModule,
    FormsModule, MatFormFieldModule, MatInputModule 
  ],
  templateUrl: './app.html', 
  styleUrls: ['./app.scss']  
})
export class App implements OnInit {
  title = 'Frigometal ERP';

  @ViewChild('dialogoCambioPassword') dialogoCambioPassword!: TemplateRef<any>;

  // 👇 VARIABLE DE ESTADO MULTI-EMPRESA 👇
  negocioActivo: string = 'PRINCIPAL';

  // Variables para el formulario de contraseña
  passActual: string = '';
  passNueva: string = '';
  passConfirmar: string = '';
  mostrarActual: boolean = false;
  mostrarNueva: boolean = false;

  constructor(
    public authService: AuthService, 
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  // 👇 1. AL CARGAR LA APP, RECUPERAMOS LA EMPRESA GUARDADA 👇
  ngOnInit(): void {
    const negocioGuardado = localStorage.getItem('negocioActivo');
    if (negocioGuardado) {
      this.negocioActivo = negocioGuardado;
    }
  }

  // 👇 2. AL CAMBIAR DE EMPRESA, GUARDAMOS EN MEMORIA Y AVISAMOS 👇
  cambiarNegocio(nuevoNegocio: string): void {
    this.negocioActivo = nuevoNegocio;
    localStorage.setItem('negocioActivo', nuevoNegocio);
    
    // Disparamos un evento invisible para que Estadísticas (u otros componentes) se enteren del cambio
    window.dispatchEvent(new Event('negocioCambiado'));
  }

  // Lógica de cambio de contraseña
  abrirCambioPassword(): void {
    this.passActual = '';
    this.passNueva = '';
    this.passConfirmar = '';
    this.mostrarActual = false;
    this.mostrarNueva = false;

    this.dialog.open(this.dialogoCambioPassword, {
      width: '400px',
      disableClose: true 
    });
  }

  guardarNuevaPassword(): void {
    this.authService.cambiarPassword(this.passActual, this.passNueva).subscribe({
      next: () => {
        this.snackBar.open('✅ Contraseña actualizada con éxito', 'Genial', { duration: 4000 });
        this.dialog.closeAll(); 
      },
      error: (err) => {
        const mensaje = err.error?.detail || 'Error al cambiar la contraseña';
        this.snackBar.open(`❌ ${mensaje}`, 'Cerrar', { duration: 4000 });
      }
    });
  }

  cerrarSesion() {
    this.authService.cerrarSesion();
  }
}