import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';

import { Usuario, UsuarioService } from '../../services/usuario';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, MatCardModule, 
    MatFormFieldModule, MatInputModule, MatButtonModule, 
    MatIconModule, MatSelectModule, MatSnackBarModule
  ],
  templateUrl: './registro.html',
  styleUrls: ['./registro.scss']
})
export class RegistroComponent {
  nuevoUsuario: Usuario = {
    id_usuario:'',
    nombre: '',
    correo: '', // 👈 NUEVO
    password: '', // 👈 NUEVO
    rol: 'TRABAJADOR',
    horas_maximas_semanales: 40,
    activo: true
  };
  cargando: boolean = false;

  constructor(
    private usuarioService: UsuarioService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  registrar(): void {
    // 👇 Añadimos el correo y el password a la validación obligatoria
    if (!this.nuevoUsuario.nombre || !this.nuevoUsuario.correo || !this.nuevoUsuario.password || !this.nuevoUsuario.horas_maximas_semanales) {
      this.snackBar.open('⚠️ Por favor completa todos los campos obligatorios', 'Cerrar', { duration: 3000 });
      return;
    }

    this.cargando = true;
    
    // Llamamos al servicio (el que usa la interfaz que acabamos de arreglar)
    this.usuarioService.crearUsuario(this.nuevoUsuario).subscribe({
      next: () => {
        this.snackBar.open('✅ Usuario registrado exitosamente', 'Excelente', { duration: 4000 });
        this.router.navigate(['/login']); // ¡Esta redirección es perfecta!
      },
      error: (err) => {
        this.cargando = false;
        // 👇 Mejoramos el error para que muestre si el correo ya estaba registrado
        const mensaje = err.error?.detail || 'Error al registrar usuario';
        this.snackBar.open(`❌ ${mensaje}`, 'Cerrar', { duration: 4000 });
      }
    });
  }

  onArchivoSeleccionado(event: any): void {
    const archivo: File = event.target.files[0];
    
    if (archivo) {
      if (!archivo.name.endsWith('.xlsx') && !archivo.name.endsWith('.xls')) {
        this.snackBar.open('⚠️ Por favor, selecciona un Excel válido', 'Cerrar', { duration: 3000 });
        return;
      }

      this.snackBar.open('⏳ Registrando personal...', '', { duration: 2000 });

      // 👇 LLamamos al servicio de usuarios
      this.usuarioService.importarUsuariosExcel(archivo).subscribe({
        next: (respuesta) => {
          this.snackBar.open(`✅ ${respuesta.mensaje}`, 'Excelente', { duration: 5000 });
          
          if (respuesta.errores && respuesta.errores.length > 0) {
            console.warn('Errores:', respuesta.errores);
            alert(`Se importó el personal, pero hubo detalles:\n\n${respuesta.errores.join('\n')}`);
          }

           
          event.target.value = ''; 
        },
        error: (err) => {
          console.error(err);
          this.snackBar.open('❌ Error al procesar el archivo', 'Cerrar', { duration: 4000 });
          event.target.value = ''; 
        }
      });
    }
  }
}
