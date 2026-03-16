import { Component, OnInit } from '@angular/core'; // 👈 Añadimos OnInit
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
import { MatChipsModule } from '@angular/material/chips'; // 👈 Usamos el módulo completo

// 👇 Importamos MatTableModule para la vista, y MatTableDataSource para los datos
import { MatTableModule, MatTableDataSource } from '@angular/material/table'; 

import { Usuario, UsuarioService } from '../../services/usuario';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, MatCardModule, 
    MatFormFieldModule, MatInputModule, MatButtonModule, 
    MatIconModule, MatSelectModule, MatSnackBarModule, 
    MatChipsModule, MatTableModule // 👈 Corregido: MatTableModule en lugar de MatTableDataSource
  ],
  templateUrl: './registro.html',
  styleUrls: ['./registro.scss']
})
export class RegistroComponent implements OnInit { // 👈 Añadimos implements OnInit
  
  // ==========================================
  // VARIABLES DEL FORMULARIO
  // ==========================================
  nuevoUsuario: Usuario = {
    id_usuario:'',
    nombre: '',
    correo: '', 
    password: '', 
    rol: 'TRABAJADOR',
    horas_maximas_semanales: 40,
    activo: true
  };
  cargando: boolean = false;

  // ==========================================
  // VARIABLES DE LA TABLA
  // ==========================================
  dataSource = new MatTableDataSource<any>([]);
  columnasMostradas: string[] = ['cedula', 'nombre', 'correo', 'rol', 'horas', 'acciones'];

  constructor(
    private usuarioService: UsuarioService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  // 👇 Se ejecuta apenas carga la pantalla
  ngOnInit(): void {
    this.cargarPersonal();
  }

  // ==========================================
  // FUNCIONES DE LA TABLA
  // ==========================================
  cargarPersonal(): void {
    this.usuarioService.getUsuarios().subscribe({
      next: (datos) => {
        this.dataSource.data = datos;
      },
      error: (err) => console.error('Error al cargar empleados', err)
    });
  }

 modoEdicion: boolean = false;

  // 2. Modifica tu función editarEmpleado para que llene el formulario
  editarEmpleado(empleado: any): void {
    this.modoEdicion = true;
    
    this.nuevoUsuario = {
      id_usuario: empleado.id_usuario,
      nombre: empleado.nombre_completo || empleado.nombre, // Depende de cómo venga de tu BD
      correo: empleado.correo,
      password: '', // 👈 Se deja vacío por seguridad. Solo se llena si se quiere cambiar.
      rol: empleado.rol,
      horas_maximas_semanales: empleado.horas_maximas_semanales,
      activo: empleado.activo !== undefined ? empleado.activo : true
    };

    // Un toque elegante: hacemos scroll suave hacia arriba para ver el formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 3. Función para cancelar la edición
  cancelarEdicion(): void {
    this.modoEdicion = false;
    // Limpiamos el formulario
    this.nuevoUsuario = { id_usuario:'', nombre: '', correo: '', password: '', rol: 'TRABAJADOR', horas_maximas_semanales: 40, activo: true };
  }

  // 4. Función para guardar los cambios
  guardarEdicion(): void {
    if (!this.nuevoUsuario.nombre || !this.nuevoUsuario.correo || !this.nuevoUsuario.horas_maximas_semanales) {
      this.snackBar.open('⚠️ Faltan campos obligatorios', 'Cerrar', { duration: 3000 });
      return;
    }

    this.cargando = true;

    // Preparamos los datos. Si no escribió password, NO lo enviamos para que el backend no lo borre.
    const datosActualizar: any = {
      nombre: this.nuevoUsuario.nombre,
      correo: this.nuevoUsuario.correo,
      rol: this.nuevoUsuario.rol,
      horas_maximas_semanales: this.nuevoUsuario.horas_maximas_semanales,
      activo: this.nuevoUsuario.activo
    };

    if (this.nuevoUsuario.password && this.nuevoUsuario.password.trim() !== '') {
      datosActualizar.password = this.nuevoUsuario.password; // Solo lo enviamos si escribió una nueva
    }

    this.usuarioService.actualizarUsuario(this.nuevoUsuario.id_usuario, datosActualizar).subscribe({
      next: () => {
        this.snackBar.open('✅ Empleado actualizado exitosamente', 'Excelente', { duration: 4000 });
        this.cargarPersonal(); // Recargamos la tabla
        this.cancelarEdicion(); // Salimos del modo edición
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        const mensaje = err.error?.detail || 'Error al actualizar usuario';
        this.snackBar.open(`❌ ${mensaje}`, 'Cerrar', { duration: 4000 });
      }
    });
  }

  // ==========================================
  // FUNCIONES DEL FORMULARIO
  // ==========================================
  registrar(): void {
    if (!this.nuevoUsuario.nombre || !this.nuevoUsuario.correo || !this.nuevoUsuario.password || !this.nuevoUsuario.horas_maximas_semanales) {
      this.snackBar.open('⚠️ Por favor completa todos los campos obligatorios', 'Cerrar', { duration: 3000 });
      return;
    }

    this.cargando = true;
    
    this.usuarioService.crearUsuario(this.nuevoUsuario).subscribe({
      next: () => {
        this.snackBar.open('✅ Usuario registrado exitosamente', 'Excelente', { duration: 4000 });
        this.cargarPersonal(); // 👈 Actualizamos la tabla de abajo automáticamente
        
        // Limpiamos el formulario (Opcional, si quieres que se queden en la pantalla)
        this.nuevoUsuario = { id_usuario:'', nombre: '', correo: '', password: '', rol: 'TRABAJADOR', horas_maximas_semanales: 40, activo: true };
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
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

      this.usuarioService.importarUsuariosExcel(archivo).subscribe({
        next: (respuesta) => {
          this.snackBar.open(`✅ ${respuesta.mensaje}`, 'Excelente', { duration: 5000 });
          
          if (respuesta.errores && respuesta.errores.length > 0) {
            console.warn('Errores:', respuesta.errores);
            alert(`Se importó el personal, pero hubo detalles:\n\n${respuesta.errores.join('\n')}`);
          }
          
          this.cargarPersonal(); // 👈 Actualizamos la tabla después de importar
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