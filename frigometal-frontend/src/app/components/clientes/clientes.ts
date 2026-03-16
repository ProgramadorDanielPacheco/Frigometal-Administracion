import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Material Modules
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';

// Servicio
import { Cliente, ClienteService } from '../../services/cliente'; 

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    MatCardModule, MatFormFieldModule, MatInputModule, 
    MatButtonModule, MatSnackBarModule, MatTableModule, MatIconModule
  ],
  templateUrl: './clientes.html'
})
export class ClientesComponent implements OnInit {
  
  // Variables de la tabla (Añadimos 'acciones' al final)
  dataSource = new MatTableDataSource<Cliente>([]);
  columnasMostradas: string[] = ['id_cliente', 'nombre', 'telefono', 'correo', 'direccion', 'acciones'];
  
  // Variables del formulario
  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false; // 👈 NUEVO: Controla si estamos creando o editando
  nuevoCliente: Cliente = { id_cliente: '', nombre: '', telefono: '', correo: '', direccion: '' };

  constructor(
    private clienteService: ClienteService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarClientes();
  }

  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) {
      this.cancelarEdicion(); // Si cierra el form, limpiamos todo
    }
    this.cdr.detectChanges();
  }

  cargarClientes(): void {
    this.clienteService.getClientes().subscribe({
      next: (datos) => {
        this.dataSource.data = datos;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar clientes', err)
    });
  }

  // 👇 LÓGICA PARA MODO EDICIÓN
  editarCliente(cliente: Cliente): void {
    this.modoEdicion = true;
    this.mostrarFormulario = true;
    
    // Clonamos los datos para no afectar la tabla hasta que se guarde
    this.nuevoCliente = { ...cliente }; 
    
    // Hacemos scroll suave hacia el formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.nuevoCliente = { id_cliente: '', nombre: '', telefono: '', correo: '', direccion: '' };
  }

  guardarCliente(): void {
    if (!this.nuevoCliente.id_cliente || !this.nuevoCliente.nombre) {
      this.snackBar.open('⚠️ La identificación y el nombre son obligatorios', 'Cerrar', { duration: 3000 });
      return;
    }

    if (this.modoEdicion) {
      // 🔵 MODO ACTUALIZAR
      const datosActualizar = {
        nombre: this.nuevoCliente.nombre,
        telefono: this.nuevoCliente.telefono,
        correo: this.nuevoCliente.correo,
        direccion: this.nuevoCliente.direccion
      };

      this.clienteService.actualizarCliente(this.nuevoCliente.id_cliente, datosActualizar).subscribe({
        next: () => {
          this.snackBar.open('✅ Cliente actualizado con éxito', 'Genial', { duration: 4000 });
          this.mostrarFormulario = false;
          this.cancelarEdicion();
          this.cargarClientes();
        },
        error: (err) => {
          const mensajeError = err.error?.detail || 'Error al actualizar el cliente';
          this.snackBar.open(`❌ ${mensajeError}`, 'Cerrar', { duration: 4000 });
        }
      });

    } else {
      // 🟢 MODO CREAR (Lo que ya tenías)
      this.clienteService.crearCliente(this.nuevoCliente).subscribe({
        next: () => {
          this.snackBar.open('✅ Cliente registrado con éxito', 'Genial', { duration: 4000 });
          this.mostrarFormulario = false;
          this.cancelarEdicion();
          this.cargarClientes();
        },
        error: (err) => {
          const mensajeError = err.error?.detail || 'Error al registrar el cliente';
          this.snackBar.open(`❌ ${mensajeError}`, 'Cerrar', { duration: 4000 });
        }
      });
    }
  }

  onArchivoSeleccionado(event: any): void {
    const archivo: File = event.target.files[0];
    if (archivo) {
      if (!archivo.name.endsWith('.xlsx') && !archivo.name.endsWith('.xls')) {
        this.snackBar.open('⚠️ Por favor, selecciona un archivo de Excel válido', 'Cerrar', { duration: 3000 });
        return;
      }
      this.snackBar.open('⏳ Leyendo y subiendo archivo...', '', { duration: 2000 });
      this.clienteService.importarClientesExcel(archivo).subscribe({
        next: (respuesta) => {
          this.snackBar.open(`✅ ${respuesta.mensaje}`, 'Excelente', { duration: 5000 });
          if (respuesta.errores && respuesta.errores.length > 0) {
            alert(`Se importaron los clientes correctamente, pero ignoramos algunas filas con errores:\n\n${respuesta.errores.join('\n')}`);
          }
          this.cargarClientes();
          event.target.value = ''; 
        },
        error: (err) => {
          const mensaje = err.error?.detail || 'Error al procesar el archivo Excel';
          this.snackBar.open(`❌ ${mensaje}`, 'Cerrar', { duration: 4000 });
          event.target.value = ''; 
        }
      });
    }
  }
}