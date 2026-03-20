import { Component, OnInit } from '@angular/core';
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
import { OrdenProduccionService } from '../../services/orden-produccion';

@Component({
  selector: 'app-ordenes-produccion',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule, 
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, 
    MatDatepickerModule, MatNativeDateModule, MatSnackBarModule
  ],
  templateUrl: './ordenes-produccion.html',
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-ES' }],
})
export class OrdenesProduccionComponent implements OnInit {
  
  nuevaOrden: any = this.obtenerModeloVacio();
  nuevoEquipo: any = { cantidad: 1, descripcion: '' };
  formasDePago: string[] = ['Efectivo', 'Transferencia Bancaria', 'Tarjeta de Crédito', 'Cheque'];

  constructor(
    private ordenService: OrdenProduccionService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {}

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

  // 👇 Magia: Calcula el saldo automáticamente 👇
  calcularSaldo(): void {
    const precio = Number(this.nuevaOrden.precio_total) || 0;
    const abono = Number(this.nuevaOrden.valor_abono) || 0;
    this.nuevaOrden.saldo = precio - abono;
  }

  agregarEquipo(): void {
    if (this.nuevoEquipo.descripcion.trim() === '') {
      this.snackBar.open('⚠️ Escribe la descripción del equipo', 'Cerrar', { duration: 3000 });
      return;
    }
    this.nuevaOrden.equipos.push({ ...this.nuevoEquipo });
    this.nuevoEquipo = { cantidad: 1, descripcion: '' }; // Limpiamos
  }

  eliminarEquipo(index: number): void {
    this.nuevaOrden.equipos.splice(index, 1);
  }

  crearOrden(): void {
    if (!this.nuevaOrden.numero_op || !this.nuevaOrden.cliente_nombre) {
      this.snackBar.open('⚠️ Faltan datos obligatorios (OP y Cliente)', 'Cerrar', { duration: 4000 });
      return;
    }

    this.snackBar.open('⏳ Guardando Orden...', '', { duration: 2000 });

    // Aseguramos que las fechas se envíen formateadas si existen
    const payload = { ...this.nuevaOrden };
    if (payload.fecha_pedido) payload.fecha_pedido = payload.fecha_pedido.toISOString().split('T')[0];
    if (payload.fecha_inicio) payload.fecha_inicio = payload.fecha_inicio.toISOString().split('T')[0];
    if (payload.fecha_entrega) payload.fecha_entrega = payload.fecha_entrega.toISOString().split('T')[0];
    if (payload.fecha_abono) payload.fecha_abono = payload.fecha_abono.toISOString().split('T')[0];

    this.ordenService.crearOrden(payload).subscribe({
      next: () => {
        this.snackBar.open('✅ Orden de Producción creada con éxito', 'Excelente', { duration: 4000 });
        this.nuevaOrden = this.obtenerModeloVacio(); // Reseteamos el form
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => {
        const msg = err.error?.detail || 'Error al crear la orden';
        this.snackBar.open(`❌ ${msg}`, 'Cerrar', { duration: 5000 });
      }
    });
  }
}