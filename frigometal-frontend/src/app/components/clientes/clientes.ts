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
import { MatMenuModule } from '@angular/material/menu';
import { ReportesService } from '../../services/reportes';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    MatCardModule, MatFormFieldModule, MatInputModule, 
    MatButtonModule, MatSnackBarModule, MatTableModule, MatIconModule, MatMenuModule
  ],
  templateUrl: './clientes.html'
})
export class ClientesComponent implements OnInit {
  
  // Variables de la tabla (Añadimos 'acciones' al final)
  dataSource = new MatTableDataSource<Cliente>([]);
  columnasMostradas: string[] = ['id_cliente', 'nombre', 'nombre_comercial', 'telefono', 'correo', 'direccion','ciudad', 'acciones'];
  
  // Variables del formulario
  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false; // 👈 NUEVO: Controla si estamos creando o editando
  nuevoCliente: Cliente = { id_cliente: '', nombre: '', nombre_comercial: '', telefono: '', correo: '', direccion: '' , ciudad:''};

  constructor(
    private clienteService: ClienteService,
    private snackBar: MatSnackBar,
    private reportesService: ReportesService,
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
    this.nuevoCliente = { id_cliente: '', nombre: '', nombre_comercial: '', telefono: '', correo: '', direccion: '', ciudad: '' };
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
        nombre_comercial: this.nuevoCliente.nombre_comercial,
        telefono: this.nuevoCliente.telefono,
        correo: this.nuevoCliente.correo,
        direccion: this.nuevoCliente.direccion,
        ciudad: this.nuevoCliente.ciudad
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

  // 👇 NUEVA FUNCIÓN PARA ELIMINAR CLIENTES DUPLICADOS 👇
  eliminarCliente(cliente: Cliente): void {
    const confirmacion = confirm(`¿Estás seguro de que deseas eliminar al cliente "${cliente.nombre}"?\nEsta acción no se puede deshacer.`);
    
    if (confirmacion) {
      this.clienteService.eliminarCliente(cliente.id_cliente).subscribe({
        next: () => {
          this.snackBar.open(`🗑️ Cliente eliminado correctamente`, 'OK', { duration: 4000 });
          this.cargarClientes(); // Refrescamos la tabla para que desaparezca
        },
        error: (err) => {
          const mensajeError = err.error?.detail || 'Error al eliminar el cliente. Verifica que no tenga órdenes vinculadas.';
          this.snackBar.open(`❌ ${mensajeError}`, 'Cerrar', { duration: 5000 });
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

  generarReporte(formato: 'excel' | 'pdf'): void {
    const clientes = this.dataSource.data;

    if (clientes.length === 0) {
      this.snackBar.open('⚠️ No hay clientes para exportar', 'Cerrar', { duration: 3000 });
      return;
    }

    // Mapeamos y limpiamos los datos para el reporte
    const datosLimpios = clientes.map(c => ({
      'Cédula / RUC': c.id_cliente,
      'Nombre / Razón Social': c.nombre,
      'Nombre Comercial': c.nombre_comercial  || 'No registrado',
      'Teléfono': c.telefono || 'No registrado',
      'Correo Electrónico': c.correo || 'No registrado',
      'Dirección': c.direccion || 'No registrada',
      'Ciudad': c.ciudad || 'No registrada'
    }));

    // Enviamos al servicio de reportes
    if (formato === 'excel') {
      this.reportesService.exportarExcel(datosLimpios, 'Directorio_Clientes_Frigometal');
    } else {
      const columnas = ['Cédula / RUC', 'Nombre / Razón Social', 'Nombre Comercial', 'Teléfono', 'Correo Electrónico', 'Dirección', 'Ciudad'];
      this.reportesService.exportarPDF(datosLimpios, columnas, 'Directorio de Clientes', 'Clientes_Frigometal');
    }
  }
}