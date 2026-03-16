import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // <-- NUEVO: Para usar [(ngModel)]

import { OrdenCompra, CompraService } from '../../services/compra';
import { Material, MaterialService } from '../../services/material'; 

import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card'; 
import { MatListModule } from '@angular/material/list'; 
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; 
import { MatFormFieldModule } from '@angular/material/form-field'; // <-- NUEVO
import { MatInputModule } from '@angular/material/input'; // <-- NUEVO
import { MatSelectModule } from '@angular/material/select'; // <-- NUEVO

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [
    MatTableModule, MatButtonModule, MatIconModule, MatChipsModule, 
    MatCardModule, MatListModule, MatSnackBarModule, CommonModule,
    FormsModule, MatFormFieldModule, MatInputModule, MatSelectModule // <-- AGREGADOS AQUÍ
  ],
  templateUrl: './compras.html',
  styleUrls: ['./compras.scss']
})
export class ComprasComponent implements OnInit {
  dataSource = new MatTableDataSource<OrdenCompra>([]);
  columnasMostradas: string[] = ['id_orden', 'proveedor', 'estado', 'acciones'];

  // Variables para el panel de detalles
  ordenSeleccionada: OrdenCompra | null = null;
  detallesOrden: any[] = [];
  materialesBodega: Material[] = []; 

  // 👇 NUEVAS VARIABLES PARA EDICIÓN 👇
  proveedores: any[] = [];
  modoEdicionDetalle: boolean = false;

  constructor(
    private compraService: CompraService,
    private materialService: MaterialService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarOrdenes();
    // Cargamos los materiales para poder mostrar sus nombres
    this.materialService.getMateriales().subscribe(datos => this.materialesBodega = datos);
    
    // 👇 Cargamos la lista de proveedores al iniciar
    this.compraService.getProveedores().subscribe(datos => this.proveedores = datos);
  }

  cargarOrdenes(): void {
    this.compraService.getOrdenes().subscribe({
      next: (datos) => this.dataSource.data = datos,
      error: (err) => console.error('Error al cargar órdenes de compra', err)
    });
  }

  // 👇 LÓGICA DEL PANEL DE DETALLES 👇
  verDetalles(orden: OrdenCompra): void {
    this.ordenSeleccionada = orden;
    this.compraService.getDetallesOrden(orden.id_orden_compra).subscribe({
      next: (detalles) => {
        this.detallesOrden = detalles;
        this.cdr.detectChanges();
        // Hacemos scroll hacia abajo
        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
      },
      error: (err) => this.snackBar.open('❌ Error al cargar detalles', 'Cerrar', {duration: 3000})
    });
  }

  cerrarDetalles(): void {
    this.ordenSeleccionada = null;
    this.detallesOrden = [];
    this.modoEdicionDetalle = false; // 👇 Apagamos el modo edición al cerrar
  }

  obtenerNombreMaterial(idMaterial: number): string {
    const material = this.materialesBodega.find(m => m.id_material === idMaterial);
    return material ? material.nombre : `Material #${idMaterial}`;
  }

  // 👇 LÓGICA PARA ACTUALIZAR ESTADO 👇
  cambiarEstado(id_orden: number, nuevoEstado: string): void {
    this.compraService.actualizarEstadoOrden(id_orden, nuevoEstado).subscribe({
      next: () => {
        this.snackBar.open(`✅ Orden marcada como ${nuevoEstado}`, 'Excelente', {duration: 4000});
        this.cargarOrdenes(); // Refrescamos la tabla
        
        // Si teníamos el panel abierto, actualizamos su estado visualmente
        if (this.ordenSeleccionada && this.ordenSeleccionada.id_orden_compra === id_orden) {
          this.ordenSeleccionada.estado = nuevoEstado;
        }
      },
      error: (err) => this.snackBar.open('❌ Error al actualizar', 'Cerrar', {duration: 3000})
    });
  }

  // ==========================================
  // 👇 NUEVAS FUNCIONES PARA EDITAR BORRADOR 👇
  // ==========================================
  activarEdicion(): void {
    this.modoEdicionDetalle = true;
  }

  cancelarEdicion(): void {
    this.modoEdicionDetalle = false;
    // Recargamos los detalles originales desde la base de datos para descartar los cambios no guardados
    if (this.ordenSeleccionada) {
      this.verDetalles(this.ordenSeleccionada); 
    }
  }

  guardarEdicionOrden(): void {
    if (!this.ordenSeleccionada) return;

    // Preparamos el paquete de datos tal como lo espera FastAPI
    const datosEdicion = {
      id_proveedor: this.ordenSeleccionada.id_proveedor,
      detalles: this.detallesOrden.map(d => ({
        id_detalle_compra: d.id_detalle_compra,
        cantidad: d.cantidad // La nueva cantidad que el usuario escribió
      }))
    };

    this.compraService.editarOrdenCompra(this.ordenSeleccionada.id_orden_compra, datosEdicion).subscribe({
      next: () => {
        this.snackBar.open('✅ Borrador modificado correctamente', 'Excelente', {duration: 3000});
        this.modoEdicionDetalle = false;
        this.cargarOrdenes(); // Refrescamos la tabla principal por si cambió el proveedor
      },
      error: () => this.snackBar.open('❌ Error al modificar la orden', 'Cerrar', {duration: 3000})
    });
  }
}