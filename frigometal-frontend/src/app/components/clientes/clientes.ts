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
  
  // Variables de la tabla (Ajustadas a tu modelo)
  dataSource = new MatTableDataSource<Cliente>([]);
  columnasMostradas: string[] = ['id_cliente', 'nombre', 'telefono', 'correo', 'direccion'];
  
  // Variables del formulario
  mostrarFormulario: boolean = false;
  nuevoCliente: Cliente = { id_cliente: '',nombre: '', telefono: '', correo: '', direccion: '' };

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

  guardarCliente(): void {
    if (!this.nuevoCliente.id_cliente || !this.nuevoCliente.nombre) {
      this.snackBar.open('⚠️ La identificación y el nombre son obligatorios', 'Cerrar', { duration: 3000 });
      return;
    }

    this.clienteService.crearCliente(this.nuevoCliente).subscribe({
      next: () => {
        this.snackBar.open('✅ Cliente registrado con éxito', 'Genial', { duration: 4000 });
        this.mostrarFormulario = false;
        this.cdr.detectChanges();
        this.cargarClientes();
        
        // Limpiamos con el id_cliente vacío
        this.nuevoCliente = { id_cliente: '', nombre: '', telefono: '', correo: '', direccion: '' };
      },
      error: (err) => {
        console.error(err);
        // Extraemos el mensaje personalizado de Python, si no hay, mostramos uno genérico
        const mensajeError = err.error?.detail || 'Error al registrar el cliente';
        this.snackBar.open(`❌ ${mensajeError}`, 'Cerrar', { duration: 4000 });
      }
    });
  }

  // ==========================================
  // LÓGICA DE IMPORTACIÓN MASIVA (EXCEL)
  // ==========================================
  onArchivoSeleccionado(event: any): void {
    const archivo: File = event.target.files[0];
    
    if (archivo) {
      // Pequeña validación de seguridad en Angular
      if (!archivo.name.endsWith('.xlsx') && !archivo.name.endsWith('.xls')) {
        this.snackBar.open('⚠️ Por favor, selecciona un archivo de Excel válido', 'Cerrar', { duration: 3000 });
        return;
      }

      this.snackBar.open('⏳ Leyendo y subiendo archivo...', '', { duration: 2000 });

      this.clienteService.importarClientesExcel(archivo).subscribe({
        next: (respuesta) => {
          this.snackBar.open(`✅ ${respuesta.mensaje}`, 'Excelente', { duration: 5000 });
          
          // Si hubo filas con errores (ej. cédulas falsas o duplicados), le avisamos al usuario
          if (respuesta.errores && respuesta.errores.length > 0) {
            console.warn('Detalle de errores:', respuesta.errores);
            alert(`Se importaron los clientes correctamente, pero ignoramos algunas filas con errores:\n\n${respuesta.errores.join('\n')}`);
          }

          this.cargarClientes(); // Refrescamos la tabla para ver la magia
          event.target.value = ''; // Limpiamos el botón por si quieren subir otro Excel
        },
        error: (err) => {
          console.error(err);
          const mensaje = err.error?.detail || 'Error al procesar el archivo Excel';
          this.snackBar.open(`❌ ${mensaje}`, 'Cerrar', { duration: 4000 });
          event.target.value = ''; 
        }
      });
    }
  }
}
