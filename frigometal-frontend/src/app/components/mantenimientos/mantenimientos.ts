import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Para pipes y directivas
import { FormsModule } from '@angular/forms'; // Para ngModel

// Angular Material
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Mantenimiento, MantenimientoService } from '../../services/mantenimiento';
import { ClienteService } from '../../services/cliente';
import { ReportesService } from '../../services/reportes';
import { MatMenuModule } from '@angular/material/menu';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';


@Component({
  selector: 'app-mantenimiento',
  standalone: true, // Importante si estás usando Standalone Components
  imports: [
    CommonModule, 
    FormsModule, 
    MatTableModule, 
    MatButtonModule, 
    MatIconModule, 
    MatCardModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatSelectModule, 
    MatSnackBarModule,
    MatTooltipModule,
    MatMenuModule, 
    MatDatepickerModule, MatNativeDateModule // 👈 AÑADIDOS AQUÍ
  ],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-ES' }],
  templateUrl: './mantenimientos.html',
  styleUrls: ['./mantenimientos.scss']
})
export class MantenimientosComponent implements OnInit {
  dataSource = new MatTableDataSource<Mantenimiento>([]);
  columnasMostradas: string[] = ['cliente', 'producto', 'fecha', 'estado', 'acciones'];
  
  clientes: any[] = [];
  productos: any[] = [];
  
  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false;
  idEditando: number | null = null;
  
  nuevoMante: Mantenimiento = {
    id_cliente: '', nombre_producto: '', fecha_mantenimiento: '', descripcion: '', estado: 'Programado'
  };

  constructor(
    private manteService: MantenimientoService,
    private clienteService: ClienteService,
    private reportesServices: ReportesService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    // Cargamos clientes y productos como ya lo tenías...
    this.clienteService.getClientes().subscribe(res => this.clientes = res);
    

    // 👇 MODIFICACIÓN AQUÍ: Ordenamos antes de mostrar 👇
    this.manteService.getMantenimientos().subscribe(res => {
      const mantenimientosOrdenados = res.sort((a, b) => {
        const aEsUrgente = this.esFechaCercana(a.fecha_mantenimiento);
        const bEsUrgente = this.esFechaCercana(b.fecha_mantenimiento);

        // Regla 1: Si 'A' es urgente y 'B' no, 'A' va primero
        if (aEsUrgente && !bEsUrgente) return -1;
        // Regla 2: Si 'B' es urgente y 'A' no, 'B' va primero
        if (!aEsUrgente && bEsUrgente) return 1;

        // Regla 3: Si ambos son urgentes (o ninguno lo es), ordenamos por fecha más próxima
        return new Date(a.fecha_mantenimiento).getTime() - new Date(b.fecha_mantenimiento).getTime();
      });

      this.dataSource.data = mantenimientosOrdenados;
    });
  }

  esFechaCercana(fechaStr: string): boolean {
    const fecha = new Date(fechaStr + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const diff = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return diff <= 3 && diff >= 0;
  }

  guardar(): void {
    // 1. Creamos una copia de los datos para enviarlos al backend (payload)
    const payload = { ...this.nuevoMante };

    // 2. 👇 CORRECCIÓN: Convertimos la fecha del calendario al formato estricto que pide Python 👇
    if (payload.fecha_mantenimiento) {
      payload.fecha_mantenimiento = new Date(payload.fecha_mantenimiento).toISOString().split('T')[0];
    }

    if (this.modoEdicion && this.idEditando) {
      this.manteService.actualizar(this.idEditando, payload).subscribe({
        next: () => {
          this.snackBar.open('✅ Mantenimiento actualizado', 'OK', {duration: 3000});
          this.finalizar();
        },
        error: (err) => {
          const msg = err.error?.detail || 'Error al actualizar';
          this.snackBar.open('❌ ' + msg, 'Cerrar');
        }
      });
    } else {
      this.manteService.crear(payload).subscribe({
        next: () => {
          this.snackBar.open('📅 Mantenimiento agendado', 'OK', {duration: 3000});
          this.finalizar();
        },
        error: (err) => {
          const msg = err.error?.detail || 'Error al agendar';
          this.snackBar.open('❌ ' + msg, 'Cerrar');
        }
      });
    }
  }

  editar(mante: Mantenimiento): void {
    this.modoEdicion = true;
    this.idEditando = mante.id_mantenimiento!;
    this.nuevoMante = { ...mante };
    this.mostrarFormulario = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  finalizar(): void {
    this.cargarDatos();
    this.mostrarFormulario = false;
    this.modoEdicion = false;
    this.nuevoMante = { id_cliente: '', nombre_producto: '', fecha_mantenimiento: '', descripcion: '', estado: 'Programado' };
  }

  getNombreCliente(id: number) { return this.clientes.find(c => c.id_cliente === id)?.nombre || 'Cargando...'; }
  

  toggleFormulario(): void {
    if (!this.mostrarFormulario) {
      this.modoEdicion = false;
      this.idEditando = null;
      this.nuevoMante = { id_cliente:'', nombre_producto: '', fecha_mantenimiento: '', descripcion: '', estado: 'Programado' };
    }
    this.mostrarFormulario = !this.mostrarFormulario;
  }

  // 👇 NUEVA FUNCIÓN PARA COMPLETAR RÁPIDO 👇
  completarMantenimiento(mante: Mantenimiento): void {
    if (mante.id_mantenimiento) {
      this.manteService.actualizar(mante.id_mantenimiento, { estado: 'Completado' }).subscribe({
        next: () => {
          this.snackBar.open('✅ Mantenimiento marcado como Completado', 'OK', {duration: 3000});
          this.cargarDatos(); // Refrescamos la tabla para que cambie de color automáticamente
        },
        error: (err) => this.snackBar.open('❌ Error al completar', 'Cerrar')
      });
    }
  }

generarReporte(formato: 'excel' | 'pdf'): void {
    const mantenimientos = this.dataSource.data;
    

    if (mantenimientos.length === 0) {
      this.snackBar.open('⚠️ No hay mantenimientos para exportar', 'Cerrar', { duration: 3000 });
      return;
    }

    // Transformamos los datos crudos a texto legible para el reporte
    const datosLimpios = mantenimientos.map(m => {
      // Nota: Convertimos id_cliente a Number por si acaso, para que no falle tu función getNombreCliente
      const nombreCliente = this.getNombreCliente(Number(m.id_cliente));
     

      return {
        'ID': `#${m.id_mantenimiento}`,
        'Cliente': nombreCliente,
        'Producto Entregado': m.nombre_producto,
        'Fecha Programada': m.fecha_mantenimiento,
        'Descripción / Motivo': m.descripcion || 'Sin descripción',
        'Estado': m.estado
      };
    });

    // Enviamos a tu servicio de reportes
    if (formato === 'excel') {
      this.reportesServices.exportarExcel(datosLimpios, 'Mantenimientos_Frigometal');
    } else {
      const columnas = ['ID', 'Cliente', 'Producto Entregado', 'Fecha Programada', 'Descripción / Motivo', 'Estado'];
      this.reportesServices.exportarPDF(datosLimpios, columnas, 'Historial de Mantenimientos Post-Venta', 'Mantenimientos_Frigometal');
    }
  }

}