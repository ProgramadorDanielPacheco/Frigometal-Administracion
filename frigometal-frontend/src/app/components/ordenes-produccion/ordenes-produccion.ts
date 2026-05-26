import { Component, OnInit, ChangeDetectorRef, ViewChild, AfterViewInit } from '@angular/core'
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
import { MatSort, MatSortModule } from '@angular/material/sort';
import { OrdenProduccionService } from '../../services/orden-produccion';
import { RecetaService } from '../../services/receta';
import { MaterialService } from '../../services/material';
import { Producto, ProductoService } from '../../services/producto';
import { ProgramacionService } from '../../services/programacion';
import { ClienteService } from '../../services/cliente';

@Component({
  selector: 'app-ordenes-produccion',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule, 
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, 
    MatDatepickerModule, MatNativeDateModule, MatSnackBarModule,
    MatTableModule, MatSortModule
  ],
  templateUrl: './ordenes-produccion.html',
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-ES' }],
})
export class OrdenesProduccionComponent implements OnInit, AfterViewInit {
  
  dataSource = new MatTableDataSource<any>([]);
  columnasMostradas: string[] = ['numero_op', 'cliente', 'fecha_entrega', 'tiempo_taller', 'costo_teorico', 'costo_real', 'precio', 'saldo', 'acciones'];
  
  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false;
  idEditando: number | null = null;
  clientesDirectorio: any[] = [];
  filtroClientes: string = '';

  @ViewChild(MatSort) sort!: MatSort;

  indexEditandoEquipo: number | null = null;

  nuevaOrden: any = this.obtenerModeloVacio();
  nuevoEquipo: any = { cantidad: 1, descripcion: '', orden_produccion: 1 };
  formasDePago: string[] = ['Efectivo', 'Transferencia Bancaria', 'Tarjeta de Crédito', 'Cheque'];
  productosCatalogo: Producto[] = [];
  filtroProductos: string = '';
  materialesBodega: any[] = [];
  ordenesPlanta: any[] = [];
  recetaViendo: any = null; 
  indexEquipoViendoReceta: number | null = null;

  constructor(
    private ordenService: OrdenProduccionService,
    private productoService: ProductoService,
    private recetaService: RecetaService,
    private materialService: MaterialService,
    private programacionService: ProgramacionService,
    private clienteService: ClienteService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarOrdenes();
    this.productoService.getProductos().subscribe(datos => {
      this.productosCatalogo = datos;
      this.cargarClientesDirectorio();
    });

    this.materialService.getMateriales().subscribe(datos => {
      this.materialesBodega = datos;
    });

    this.programacionService.getOrdenes().subscribe(datos => {
      this.ordenesPlanta = datos;
    });
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
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
      (c.nombre && c.nombre.toLowerCase().includes(filtro)) || 
      (c.id_cliente && c.id_cliente.includes(filtro)) ||
      (c.nombre_comercial && c.nombre_comercial.toLowerCase().includes(filtro))
    );
  }

  get productosFiltrados(): Producto[] {
    if (!this.filtroProductos) return this.productosCatalogo;
    const filtro = this.filtroProductos.toLowerCase();
    
    return this.productosCatalogo.filter(p => 
      p.nombre.toLowerCase().includes(filtro) || 
      (p.id_producto && p.id_producto.toString().includes(filtro))
    );
  }

  seleccionarCliente(nombreCliente: string): void {
    const cliente = this.clientesDirectorio.find(c => c.nombre === nombreCliente);
    if (cliente) {
      this.nuevaOrden.cliente_cedula = cliente.id_cliente || ''; 
      this.nuevaOrden.cliente_direccion = cliente.direccion || '';
      this.nuevaOrden.cliente_telefono = cliente.telefono || '';
      this.nuevaOrden.cliente_email = cliente.correo || '';
    }
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

  calcularSiguienteOP(): number {
    let maxOP = 0;
    this.dataSource.data.forEach(orden => {
      if (orden.equipos) {
        orden.equipos.forEach((e: any) => {
          const op = Number(e.orden_produccion) || 0;
          if (op > maxOP) maxOP = op;
        });
      }
    });

    this.nuevaOrden.equipos.forEach((e: any) => {
      const op = Number(e.orden_produccion) || 0;
      if (op > maxOP) maxOP = op;
    });

    return maxOP === 0 ? 1 : maxOP + 1;
  }

  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) {
      this.cancelarEdicion();
    } else {
      this.nuevoEquipo.orden_produccion = this.calcularSiguienteOP();
    }
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.idEditando = null;
    this.indexEditandoEquipo = null;
    this.nuevaOrden = this.obtenerModeloVacio();
    this.nuevoEquipo = { 
      cantidad: 1, 
      descripcion: '', 
      orden_produccion: this.calcularSiguienteOP(),
      id_producto: null,
      nombre_producto: '',
      receta_historica: [],
      costo_total_equipo: 0
    };
  }

  editarOrden(orden: any): void {
    this.modoEdicion = true;
    this.idEditando = orden.id_orden;
    this.mostrarFormulario = true;
    
    this.nuevaOrden = { ...orden };
    if (!this.nuevaOrden.equipos) this.nuevaOrden.equipos = [];
    
    this.nuevoEquipo.orden_produccion = this.calcularSiguienteOP();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  calcularSaldo(): void {
    const precio = Number(this.nuevaOrden.precio_total) || 0;
    const abono = Number(this.nuevaOrden.valor_abono) || 0;
    this.nuevaOrden.saldo = precio - abono;
  }

  seleccionarProductoCatalogo(idProducto: number): void {
    const prod = this.productosCatalogo.find(p => p.id_producto === idProducto);
    if (!prod) return;

    this.nuevoEquipo.id_producto = prod.id_producto;
    this.nuevoEquipo.nombre_producto = prod.nombre;
    this.nuevoEquipo.descripcion = prod.nombre;

    this.snackBar.open('⏳ Cargando receta base...', '', { duration: 1500 });

    this.recetaService.getReceta(prod.id_producto!).subscribe({
      next: (receta) => {
        this.nuevoEquipo.receta_historica = receta.map((r: any) => {
          const materialBD = this.materialesBodega.find(m => m.id_material === r.id_material);
          const precioBase = materialBD ? Number(materialBD.precio_unitario) : 0;
          const cantOriginal = Number(r.cantidad_necesaria || r.cantidad_requerida || 0);
          
          return {
            id_material: r.id_material,
            nombre_material: materialBD ? materialBD.nombre : 'Material Desconocido',
            cantidad_requerida: cantOriginal,
            cantidad_real: cantOriginal, 
            precio_unitario: precioBase, 
            subtotal: cantOriginal * precioBase
          };
        });

        this.recalcularCostoNuevoEquipo();
      },
      error: () => {
        this.nuevoEquipo.receta_historica = [];
        this.snackBar.open('⚠️ Este producto no tiene receta configurada', 'Cerrar', { duration: 3000 });
      }
    });
  }

  // 👇 NUEVA FUNCIÓN: Sincroniza una receta que quedó en 0 👇
  sincronizarReceta(index: number): void {
    const equipo = this.nuevaOrden.equipos[index];
    if (!equipo.id_producto) {
      this.snackBar.open('⚠️ Este equipo no está enlazado a un producto del catálogo', 'Cerrar', { duration: 3000 });
      return;
    }

    this.snackBar.open('⏳ Sincronizando receta desde bodega...', '', { duration: 1500 });

    this.recetaService.getReceta(equipo.id_producto).subscribe({
      next: (receta) => {
        equipo.receta_historica = receta.map((r: any) => {
          const materialBD = this.materialesBodega.find(m => m.id_material === r.id_material);
          const precioBase = materialBD ? Number(materialBD.precio_unitario) : 0;
          const cantOriginal = Number(r.cantidad_necesaria || r.cantidad_requerida || 0);
          
          return {
            id_material: r.id_material,
            nombre_material: materialBD ? materialBD.nombre : 'Material Desconocido',
            cantidad_requerida: cantOriginal,
            cantidad_real: cantOriginal,
            precio_unitario: precioBase,
            subtotal: cantOriginal * precioBase
          };
        });

        this.recalcularCostoHistorico(index);
        this.snackBar.open('✅ Receta actualizada. Recuerda presionar "ACTUALIZAR ORDEN" para guardar los cambios.', 'Entendido', { duration: 5000 });
      },
      error: () => {
        this.snackBar.open('⚠️ Este producto sigue sin tener receta en bodega', 'Cerrar', { duration: 3000 });
      }
    });
  }

  recalcularCostoNuevoEquipo(): void {
    if(!this.nuevoEquipo.receta_historica) return;
    this.nuevoEquipo.costo_total_equipo = this.nuevoEquipo.receta_historica.reduce(
      (sum: number, mat: any) => sum + (mat.cantidad_real * mat.precio_unitario), 0
    );
  }

  recalcularCostoHistorico(indexEquipo: number | null): void {
    if (indexEquipo === null) return; 

    const equipo = this.nuevaOrden.equipos[indexEquipo];
    if(!equipo || !equipo.receta_historica) return;
    
    let total = 0;
    equipo.receta_historica.forEach((mat: any) => {
      mat.subtotal = Number(mat.cantidad_real) * Number(mat.precio_unitario);
      total += mat.subtotal;
    });
    equipo.costo_total_equipo = total;
  }

  verRecetaEquipo(index: number): void {
    this.indexEquipoViendoReceta = index;
    this.recetaViendo = this.nuevaOrden.equipos[index];
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
  }

  cerrarRecetaEquipo(): void {
    this.indexEquipoViendoReceta = null;
    this.recetaViendo = null;
  }

  agregarEquipo(): void {
    if (this.nuevoEquipo.descripcion.trim() === '') {
      this.snackBar.open('⚠️ Escribe la descripción del equipo', 'Cerrar', { duration: 3000 });
      return;
    }

    if (this.indexEditandoEquipo !== null) {
      this.nuevaOrden.equipos[this.indexEditandoEquipo] = { ...this.nuevoEquipo };
      this.indexEditandoEquipo = null;
    } else {
      this.nuevaOrden.equipos.push({ ...this.nuevoEquipo });
    }

    this.nuevoEquipo = { 
      cantidad: 1, 
      descripcion: '', 
      orden_produccion: this.calcularSiguienteOP() 
    }; 
  }

  editarEquipo(index: number): void {
    this.indexEditandoEquipo = index;
    this.nuevoEquipo = { ...this.nuevaOrden.equipos[index] };
  }

  eliminarEquipo(index: number): void {
    this.nuevaOrden.equipos.splice(index, 1);
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
    
    const formatearFecha = (fecha: any) => {
      if (!fecha) return null;
      if (typeof fecha === 'string') return fecha.split('T')[0];
      const d = new Date(fecha);
      const month = ('0' + (d.getMonth() + 1)).slice(-2);
      const day = ('0' + d.getDate()).slice(-2);
      return `${d.getFullYear()}-${month}-${day}`;
    };

    payload.fecha_pedido = formatearFecha(payload.fecha_pedido);
    payload.fecha_inicio = formatearFecha(payload.fecha_inicio);
    payload.fecha_entrega = formatearFecha(payload.fecha_entrega);
    payload.fecha_abono = formatearFecha(payload.fecha_abono);

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

  calcularCostoTeoricoEquipo(equipo: any): number {
    if (!equipo || !equipo.receta_historica) return 0;
    let costoReceta = 0;
    equipo.receta_historica.forEach((mat: any) => {
      const cantTeorica = Number(mat.cantidad_requerida) || 0;
      const precio = Number(mat.precio_unitario) || 0;
      costoReceta += (cantTeorica * precio);
    });
    return costoReceta * (Number(equipo.cantidad) || 1);
  }

  calcularCostoRealEquipo(equipo: any): number {
    const costoUnitario = Number(equipo.costo_total_equipo) || 0;
    return costoUnitario * (Number(equipo.cantidad) || 1);
  }

  private normalizarTurnos(data: any): any[] {
    if (!data) return [];
    if (data.turnos) return data.turnos; 
    
    let turnos = [];
    if (data.fecha_inicio_1 || data.fecha_inicio || data.responsable) {
       turnos.push({
         fecha_inicio: data.fecha_inicio_1 || data.fecha_inicio || '',
         hora_inicio: data.hora_inicio_1 || data.hora_inicio || '',
         fecha_fin: data.fecha_fin_1 || data.fecha_fin || '',
         hora_fin: data.hora_fin_1 || data.hora_fin || '',
         responsable: data.responsable || ''
       });
    }
    if (data.fecha_inicio_2) {
       turnos.push({
         fecha_inicio: data.fecha_inicio_2 || '', hora_inicio: data.hora_inicio_2 || '',
         fecha_fin: data.fecha_fin_2 || '', hora_fin: data.hora_fin_2 || '',
         responsable: data.responsable || ''
       });
    }
    if (data.turnos_extra && data.turnos_extra.length > 0) {
       data.turnos_extra.forEach((t: any) => {
         turnos.push({
           fecha_inicio: t.fecha_inicio || '', hora_inicio: t.hora_inicio || '',
           fecha_fin: t.fecha_fin || '', hora_fin: t.hora_fin || '',
           responsable: t.responsable || data.responsable || ''
         });
       });
    }
    return turnos;
  }

  private calcularMinutos(fIni?: string, hIni?: string, fFin?: string, hFin?: string): number {
    if (!fIni || !hIni || !fFin || !hFin) return 0;
    const inicio = new Date(`${fIni}T${hIni}`);
    const fin = new Date(`${fFin}T${hFin}`);
    if (fin >= inicio) return (fin.getTime() - inicio.getTime()) / 60000;
    return 0;
  }

  private calcularMinutosEquipo(equipo: any): number {
    if (!equipo || this.ordenesPlanta.length === 0) return 0;
    let totalMinutos = 0;
    const procesos = [ 
      'Corte Laser', 'Plegado', 'Estructura', 'Armado', 'Poliuretano', 
      'Vidrios', 'Puertas', 'Refrigeracion', 'Electrico', 'Armado Final', 'Reproceso' 
    ];
    
    const numOpMaquina = String(equipo.orden_produccion);
    const plantaMatch = this.ordenesPlanta.find(p => String(p.numero_op) === numOpMaquina);

    if (plantaMatch && plantaMatch.seguimiento_procesos) {
      procesos.forEach(proc => {
        const data = plantaMatch.seguimiento_procesos[proc];
        if (data) {
          const turnos = this.normalizarTurnos(data);
          turnos.forEach((t: any) => {
            totalMinutos += this.calcularMinutos(t.fecha_inicio, t.hora_inicio, t.fecha_fin, t.hora_fin);
          });
        }
      });
    }
    return totalMinutos;
  }

  calcularTiempoEquipo(equipo: any): string {
    const mins = this.calcularMinutosEquipo(equipo);
    const horas = Math.floor(mins / 60);
    const minutos = Math.round(mins % 60);
    return `${horas}h ${minutos}m`;
  }

  calcularTiempoTotalOP(orden: any): string {
    if (!orden || !orden.equipos) return '0h 0m';
    let totalMinutos = 0;
    
    orden.equipos.forEach((equipo: any) => {
      totalMinutos += this.calcularMinutosEquipo(equipo);
    });

    const horas = Math.floor(totalMinutos / 60);
    const minutos = Math.round(totalMinutos % 60);
    return `${horas}h ${minutos}m`;
  }

  finalizarOrden(orden: any): void {
    const confirmar = confirm(`⚠️ ¿Estás seguro de FINALIZAR la OP ${orden.numero_op}?\n\nAl hacerlo, los productos, cantidades y costos quedarán BLOQUEADOS permanentemente para proteger la información financiera. (Podrás seguir editando datos del cliente).`);
    
    if (confirmar) {
      this.snackBar.open('⏳ Bloqueando productos y sellando OP...', '', { duration: 2000 });
      
      this.ordenService.actualizarOrden(orden.id_orden, { finalizada: true }).subscribe({
        next: () => {
          this.snackBar.open('🔒 Orden Finalizada y Sellada con éxito', 'Cerrar', { duration: 4000 });
          this.cargarOrdenes(); 
        },
        error: (err) => {
          this.snackBar.open('❌ Error al finalizar la orden', 'Cerrar', { duration: 3000 });
        }
      });
    }
  }
}