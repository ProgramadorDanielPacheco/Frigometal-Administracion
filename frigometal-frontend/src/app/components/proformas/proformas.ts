import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE, MatOptionModule } from '@angular/material/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { ProformaService } from '../../services/proforma';
import { ProductoService } from '../../services/producto';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-proformas',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule, 
    MatInputModule, MatButtonModule, MatIconModule, MatDatepickerModule, 
    MatNativeDateModule, MatSnackBarModule, MatTableModule, MatOptionModule, MatSelectModule
  ],
  templateUrl: './proformas.html',
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-ES' }]
})
export class ProformasComponent implements OnInit {

  dataSource = new MatTableDataSource<any>([]);
  columnasMostradas: string[] = ['numero_proforma', 'cliente', 'fecha', 'precio_total', 'acciones']; // 👈 Añadido acciones
  
  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false; // 👈 NUEVO
  idEditando: number | null = null; // 👈 NUEVO

  nuevaProforma: any = this.obtenerModeloVacio();
  productosCatalogo: any[] = [];
  
  // Asegúrate de incluir id_producto en tu modelo vacío
  nuevoDetalle: any = { cantidad: 1, id_producto: null, descripcion: '', precio_unitario: 0, precio_total: 0 };
  

  constructor(
    private proformaService: ProformaService,
    private productoService: ProductoService, 
    private snackBar: MatSnackBar) {}

  ngOnInit(): void { this.cargarProformas(); 
    this.productoService.getProductos().subscribe(res => this.productosCatalogo = res);
  }

  cargarProformas(): void {
    this.proformaService.getProformas().subscribe(res => this.dataSource.data = res);
  }

  obtenerModeloVacio() {
    return {
      numero_proforma: '', cliente_nombre: '', cliente_direccion: '', ciudad: '', responsable: '',
      fecha_emision: new Date(), trabajo: '', detalles: [], precio_total: 0,
      garantia: '1 año a partir de la entrega del equipo (La garantia NO cubre daño eléctrico).',
      forma_pago: 'Abono 60% antes de iniciar la obra y 40% antes de la entrega.',
      validez: '15 dias'
    };
  }

  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) this.cancelarEdicion();
  }

  // 👇 NUEVA FUNCIÓN PARA CANCELAR Y LIMPIAR 👇
  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.idEditando = null;
    this.nuevaProforma = this.obtenerModeloVacio();
    this.nuevoDetalle = { cantidad: 1, id_producto: null, descripcion: '', precio_unitario: 0, precio_total: 0 };
  }

  // 👇 NUEVA FUNCIÓN PARA ACTIVAR MODO EDICIÓN 👇
  editarProforma(proforma: any): void {
    this.modoEdicion = true;
    this.idEditando = proforma.id_proforma;
    this.mostrarFormulario = true;
    
    // Clonamos los datos para no modificar la tabla en vivo
    this.nuevaProforma = { ...proforma };
    if (!this.nuevaProforma.detalles) this.nuevaProforma.detalles = [];
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  calcularTotalLinea(): void {
    this.nuevoDetalle.precio_total = this.nuevoDetalle.cantidad * this.nuevoDetalle.precio_unitario;
  }

  agregarDetalle(): void {
    if (!this.nuevoDetalle.descripcion) return;
    this.nuevaProforma.detalles.push({ ...this.nuevoDetalle });
    this.recalcularTotalGeneral();
    this.nuevoDetalle = { cantidad: 1, descripcion: '', precio_unitario: 0, precio_total: 0 };
  }

  eliminarDetalle(index: number): void {
    this.nuevaProforma.detalles.splice(index, 1);
    this.recalcularTotalGeneral();
  }

  recalcularTotalGeneral(): void {
    this.nuevaProforma.precio_total = this.nuevaProforma.detalles.reduce((sum: number, det: any) => sum + Number(det.precio_total), 0);
  }

  guardarProforma(): void {
    if (!this.nuevaProforma.numero_proforma || !this.nuevaProforma.cliente_nombre) {
      this.snackBar.open('Faltan datos clave', 'Cerrar'); return;
    }
    
    const payload = { ...this.nuevaProforma };
    if (payload.fecha_emision) payload.fecha_emision = new Date(payload.fecha_emision).toISOString().split('T')[0];

    // 👇 EVALUAMOS SI ES ACTUALIZAR O CREAR 👇
    if (this.modoEdicion && this.idEditando) {
      this.proformaService.actualizarProforma(this.idEditando, payload).subscribe({
        next: () => {
          this.snackBar.open('✅ Proforma Actualizada y OP Sincronizada', 'OK', { duration: 5000 });
          this.mostrarFormulario = false;
          this.cancelarEdicion();
          this.cargarProformas();
        },
        error: (err) => {
          const mensajeError = err.error?.detail || 'Error al actualizar';
          this.snackBar.open(`❌ ${mensajeError}`, 'Cerrar', { duration: 8000 });
        }
      });
    } else {
      this.proformaService.crearProforma(payload).subscribe({
        next: () => {
          this.snackBar.open('✅ Proforma Creada y Borrador de Orden Generado', 'OK', { duration: 5000 });
          this.mostrarFormulario = false;
          this.cancelarEdicion();
          this.cargarProformas();
        },
        error: (err) => {
          const mensajeError = err.error?.detail || 'Error al guardar';
          this.snackBar.open(`❌ ${mensajeError}`, 'Cerrar', { duration: 8000 });
        }
      });
    }
  }

  seleccionarProductoCatalogo(idProducto: number): void {
    const prod = this.productosCatalogo.find(p => p.id_producto === idProducto);
    if (prod) {
      this.nuevoDetalle.descripcion = prod.nombre;
      // Nota: Si tus productos tienen un campo de precio_venta, podrías auto-completarlo aquí también:
      // this.nuevoDetalle.precio_unitario = prod.precio_venta; 
      // this.calcularTotalLinea();
    }
  }
}