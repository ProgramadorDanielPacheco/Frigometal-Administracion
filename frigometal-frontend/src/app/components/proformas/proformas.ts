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
import { MatSelectModule } from '@angular/material/select';

import { ProformaService } from '../../services/proforma';
import { ProductoService } from '../../services/producto';
import { ClienteService } from '../../services/cliente';
// 👇 NUEVOS IMPORTACIONES 👇
import { RecetaService } from '../../services/receta'; 
import { MaterialService } from '../../services/material';

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
  columnasMostradas: string[] = ['numero_proforma', 'cliente', 'fecha', 'precio_total', 'acciones'];
  
  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false;
  idEditando: number | null = null;

  clientesDirectorio: any[] = [];
  filtroClientes: string = '';
  nuevaProforma: any = this.obtenerModeloVacio();
  productosCatalogo: any[] = [];
  materialesBodega: any[] = []; // 👈 NUEVO: Para saber los precios de la receta
  
  // 👇 NUEVO: Añadimos 'utilidad' inicializada en 30% por defecto (puedes cambiarlo)
  nuevoDetalle: any = { cantidad: 1, id_producto: null, descripcion: '', precio_unitario: 0, utilidad: 30, precio_total: 0 };
  
  constructor(
    private proformaService: ProformaService,
    private productoService: ProductoService, 
    private clienteService: ClienteService,
    private recetaService: RecetaService, // 👈 NUEVO
    private materialService: MaterialService, // 👈 NUEVO
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void { 
    this.cargarProformas(); 
    this.productoService.getProductos().subscribe(res => this.productosCatalogo = res);
    this.cargarClientesDirectorio();
    
    // 👇 Cargamos los materiales al inicio para poder calcular la receta rápido
    this.materialService.getMateriales().subscribe(res => this.materialesBodega = res);
  }

  cargarClientesDirectorio(): void {
    this.clienteService.getClientes().subscribe({
      next: (datos) => this.clientesDirectorio = datos,
      error: (err) => console.error('Error al cargar directorio', err)
    });
  }

  get clientesFiltrados(): any[] {
    if (!this.filtroClientes) return this.clientesDirectorio;
    const filtro = this.filtroClientes.toLowerCase();
    return this.clientesDirectorio.filter(c => 
      c.nombre.toLowerCase().includes(filtro) || 
      c.id_cliente.includes(filtro) ||
      (c.nombre_comercial && c.nombre_comercial.toLowerCase().includes(filtro))
    );
  }

  seleccionarCliente(nombreCliente: string): void {
    const cliente = this.clientesDirectorio.find(c => c.nombre === nombreCliente);
    if (cliente) {
      this.nuevaProforma.cliente_direccion = cliente.direccion || '';
      this.nuevaProforma.ciudad = cliente.ciudad || '';
    }
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

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.idEditando = null;
    this.nuevaProforma = this.obtenerModeloVacio();
    this.nuevoDetalle = { cantidad: 1, id_producto: null, descripcion: '', precio_unitario: 0, utilidad: 30, precio_total: 0 };
  }

  editarProforma(proforma: any): void {
    this.modoEdicion = true;
    this.idEditando = proforma.id_proforma;
    this.mostrarFormulario = true;
    
    this.nuevaProforma = { ...proforma };
    if (!this.nuevaProforma.detalles) this.nuevaProforma.detalles = [];
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================
  // 👇 CÁLCULO DE COSTOS, UTILIDAD Y PRECIO 👇
  // ==========================================
  seleccionarProductoCatalogo(idProducto: number): void {
    const prod = this.productosCatalogo.find(p => p.id_producto === idProducto);
    if (prod) {
      this.nuevoDetalle.descripcion = prod.nombre;
      
      // Consultamos la receta para armar el costo real
      this.snackBar.open('⏳ Calculando costo desde bodega...', '', { duration: 1500 });
      this.recetaService.getReceta(idProducto).subscribe({
        next: (receta) => {
          let costoTotal = 0;
          
          receta.forEach((r: any) => {
            const materialBD = this.materialesBodega.find(m => m.id_material === r.id_material);
            const precioMat = materialBD ? Number(materialBD.precio_unitario || 0) : 0;
            const cantidadMat = Number(r.cantidad_requerida || r.cantidad_necesaria || 0);
            costoTotal += (cantidadMat * precioMat);
          });
          
          // Asignamos el costo a "precio_unitario" y calculamos la ganancia
          this.nuevoDetalle.precio_unitario = parseFloat(costoTotal.toFixed(2));
          this.calcularTotalLinea();
          this.snackBar.open('✅ Costo de producción cargado', 'OK', { duration: 2000 });
        },
        error: () => {
          this.snackBar.open('⚠️ Producto sin receta. Ingresa el costo manual.', 'Cerrar', { duration: 3000 });
        }
      });
    }
  }

  calcularTotalLinea(): void {
    // 1. Calculamos el costo base (Costo de receta * Cantidad)
    const costoBase = this.nuevoDetalle.cantidad * this.nuevoDetalle.precio_unitario;
    
    // 2. Calculamos cuánto es la ganancia según el porcentaje de utilidad
    const porcentajeUtilidad = this.nuevoDetalle.utilidad / 100;
    const ganancia = costoBase * porcentajeUtilidad;
    
    // 3. El Precio de Venta final (Total)
    this.nuevoDetalle.precio_total = parseFloat((costoBase + ganancia).toFixed(2));
  }

  agregarDetalle(): void {
    if (!this.nuevoDetalle.descripcion) return;
    this.nuevaProforma.detalles.push({ ...this.nuevoDetalle });
    this.recalcularTotalGeneral();
    this.nuevoDetalle = { cantidad: 1, id_producto: null, descripcion: '', precio_unitario: 0, utilidad: 30, precio_total: 0 };
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
}