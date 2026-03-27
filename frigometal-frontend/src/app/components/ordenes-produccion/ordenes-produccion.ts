import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule, MatTableDataSource } from '@angular/material/table'; 
import { OrdenProduccionService } from '../../services/orden-produccion';

@Component({
  selector: 'app-ordenes-produccion',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule, 
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, 
    MatDatepickerModule, MatNativeDateModule, MatSnackBarModule,
    MatTableModule 
  ],
  templateUrl: './ordenes-produccion.html',
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-ES' }],
})
export class OrdenesProduccionComponent implements OnInit {
  
  dataSource = new MatTableDataSource<any>([]);
  columnasMostradas: string[] = ['numero_op', 'cliente', 'fecha_entrega', 'precio', 'saldo', 'acciones'];
  
  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false;
  idEditando: number | null = null;

  // 👇 NUEVA VARIABLE PARA SABER SI ESTAMOS EDITANDO UN EQUIPO 👇
  indexEditandoEquipo: number | null = null;

  nuevaOrden: any = this.obtenerModeloVacio();
  nuevoEquipo: any = { cantidad: 1, descripcion: '', orden_produccion: 1 };
  formasDePago: string[] = ['Efectivo', 'Transferencia Bancaria', 'Tarjeta de Crédito', 'Cheque'];

  constructor(
    private ordenService: OrdenProduccionService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarOrdenes();
  }

  cargarOrdenes(): void {
    this.ordenService.getOrdenes().subscribe({
      next: (datos) => {
        this.dataSource.data = datos;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar órdenes', err)
    });
  }

  obtenerModeloVacio() {
    return {
      numero_op: '', numero_pedido: '',
      cliente_nombre: '', cliente_cedula: '', cliente_direccion: '',
      cliente_telefono: '', cliente_email: '',
      recibido_por: '', fecha_pedido: null, fecha_inicio: null, fecha_entrega: null,
      descripcion_pedido: '', equipos: [],
      precio_total: 0, forma_pago: '', fecha_abono: null, valor_abono: 0, saldo: 0
    };
  }

  // 👇 LÓGICA DEL CONSECUTIVO AUTOMÁTICO 👇
  calcularSiguienteOP(): number {
    let maxOP = 0;

    // 1. Buscamos el mayor número en las órdenes que ya están en la base de datos
    this.dataSource.data.forEach(orden => {
      if (orden.equipos) {
        orden.equipos.forEach((e: any) => {
          const op = Number(e.orden_produccion) || 0;
          if (op > maxOP) maxOP = op;
        });
      }
    });

    // 2. Buscamos en los equipos que se están agregando ahorita a esta nueva orden
    this.nuevaOrden.equipos.forEach((e: any) => {
      const op = Number(e.orden_produccion) || 0;
      if (op > maxOP) maxOP = op;
    });

    // Si no hay nada, empieza en 1, si no, le suma 1 al mayor encontrado
    return maxOP === 0 ? 1 : maxOP + 1;
  }

  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) {
      this.cancelarEdicion();
    } else {
      // Al abrir el formulario, jalamos el siguiente OP automático
      this.nuevoEquipo.orden_produccion = this.calcularSiguienteOP();
    }
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.idEditando = null;
    this.indexEditandoEquipo = null;
    this.nuevaOrden = this.obtenerModeloVacio();
    this.nuevoEquipo = { cantidad: 1, descripcion: '', orden_produccion: 1 };
  }

  editarOrden(orden: any): void {
    this.modoEdicion = true;
    this.idEditando = orden.id_orden;
    this.mostrarFormulario = true;
    
    this.nuevaOrden = { ...orden };
    if (!this.nuevaOrden.equipos) this.nuevaOrden.equipos = [];
    
    // Sugerimos el siguiente OP por si quiere agregarle un equipo más a esta orden vieja
    this.nuevoEquipo.orden_produccion = this.calcularSiguienteOP();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  calcularSaldo(): void {
    const precio = Number(this.nuevaOrden.precio_total) || 0;
    const abono = Number(this.nuevaOrden.valor_abono) || 0;
    this.nuevaOrden.saldo = precio - abono;
  }

  // 👇 NUEVAS FUNCIONES PARA LOS EQUIPOS 👇
  agregarEquipo(): void {
    if (this.nuevoEquipo.descripcion.trim() === '') {
      this.snackBar.open('⚠️ Escribe la descripción del equipo', 'Cerrar', { duration: 3000 });
      return;
    }

    if (this.indexEditandoEquipo !== null) {
      // Modo Actualizar Equipo Existente
      this.nuevaOrden.equipos[this.indexEditandoEquipo] = { ...this.nuevoEquipo };
      this.indexEditandoEquipo = null;
    } else {
      // Modo Añadir Nuevo Equipo
      this.nuevaOrden.equipos.push({ ...this.nuevoEquipo });
    }

    // Limpiamos y preparamos automáticamente el siguiente número consecutivo
    this.nuevoEquipo = { 
      cantidad: 1, 
      descripcion: '', 
      orden_produccion: this.calcularSiguienteOP() 
    }; 
  }

  editarEquipo(index: number): void {
    this.indexEditandoEquipo = index;
    // Copiamos el equipo al formulario
    this.nuevoEquipo = { ...this.nuevaOrden.equipos[index] };
  }

  eliminarEquipo(index: number): void {
    this.nuevaOrden.equipos.splice(index, 1);
    // Si eliminó el equipo que justo estaba editando, limpiamos la edición
    if (this.indexEditandoEquipo === index) {
      this.indexEditandoEquipo = null;
      this.nuevoEquipo = { cantidad: 1, descripcion: '', orden_produccion: this.calcularSiguienteOP() };
    }
  }

  guardarOrden(): void {
    if (!this.nuevaOrden.numero_op || !this.nuevaOrden.cliente_nombre) {
      this.snackBar.open('⚠️ Faltan datos obligatorios (OP y Cliente)', 'Cerrar', { duration: 4000 });
      return;
    }

    this.snackBar.open('⏳ Guardando Orden...', '', { duration: 2000 });

    const payload = { ...this.nuevaOrden };
    if (payload.fecha_pedido) payload.fecha_pedido = new Date(payload.fecha_pedido).toISOString().split('T')[0];
    if (payload.fecha_inicio) payload.fecha_inicio = new Date(payload.fecha_inicio).toISOString().split('T')[0];
    if (payload.fecha_entrega) payload.fecha_entrega = new Date(payload.fecha_entrega).toISOString().split('T')[0];
    if (payload.fecha_abono) payload.fecha_abono = new Date(payload.fecha_abono).toISOString().split('T')[0];

    if (this.modoEdicion && this.idEditando) {
      this.ordenService.actualizarOrden(this.idEditando, payload).subscribe({
        next: () => {
          this.snackBar.open('✅ Orden actualizada con éxito', 'Excelente', { duration: 4000 });
          this.mostrarFormulario = false;
          this.cancelarEdicion();
          this.cargarOrdenes();
        },
        error: (err) => {
          const msg = err.error?.detail || 'Error al actualizar';
          this.snackBar.open(`❌ ${msg}`, 'Cerrar', { duration: 5000 });
        }
      });
    } else {
      this.ordenService.crearOrden(payload).subscribe({
        next: () => {
          this.snackBar.open('✅ Orden de Producción creada con éxito', 'Excelente', { duration: 4000 });
          this.mostrarFormulario = false;
          this.cancelarEdicion();
          this.cargarOrdenes();
        },
        error: (err) => {
          const msg = err.error?.detail || 'Error al crear la orden';
          this.snackBar.open(`❌ ${msg}`, 'Cerrar', { duration: 5000 });
        }
      });
    }
  }
}