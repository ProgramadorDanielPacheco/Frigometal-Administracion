import { Component, TemplateRef, ViewChild } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from './services/auth'; // <-- Importa esto
import { CommonModule } from '@angular/common'; // <-- Y esto
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
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, CommonModule, // <-- Agrega CommonModule aquí
    MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule, MatButtonToggleModule,
    MatButtonModule, MatMenuModule,
    MatDialogModule,
    FormsModule, MatFormFieldModule, MatInputModule // <-- ¡Crucial para que el botón se vea bonito!
  ],
  templateUrl: './app.html', // <-- Vamos a crear este archivo ahora
  styleUrls: ['./app.scss']  // <-- Y este también
})
export class App {
  title = 'Frigometal ERP';

  @ViewChild('dialogoCambioPassword') dialogoCambioPassword!: TemplateRef<any>;

  // Variables para el formulario
  passActual: string = '';
  passNueva: string = '';
  passConfirmar: string = '';
  mostrarActual: boolean = false;
  mostrarNueva: boolean = false;

  constructor(
    public authService: AuthService, // Tu servicio actual
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  abrirCambioPassword(): void {
    // Limpiamos variables antes de abrir
    this.passActual = '';
    this.passNueva = '';
    this.passConfirmar = '';
    this.mostrarActual = false;
    this.mostrarNueva = false;

    // Abrimos el modal usando la plantilla
    this.dialog.open(this.dialogoCambioPassword, {
      width: '400px',
      disableClose: true // Para que no se cierre si hacen clic afuera por error
    });
  }

  guardarNuevaPassword(): void {
    // Aquí llamamos a tu servicio existente (que modificaremos en el paso 3)
    this.authService.cambiarPassword(this.passActual, this.passNueva).subscribe({
      next: () => {
        this.snackBar.open('✅ Contraseña actualizada con éxito', 'Genial', { duration: 4000 });
        this.dialog.closeAll(); // Cerramos el modal
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