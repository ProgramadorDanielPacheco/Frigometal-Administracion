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

  // 👇 LÓGICA DE ESCÁNER PROFUNDO DEL CONSECUTIVO 👇
  calcularSiguienteOP(): number {
    let maxOP = 0;

    // 1. Escaneamos la base de datos completa
    this.dataSource.data.forEach(orden => {
      // Sacamos los números del ID general por si le pusieron "OP-90"
      const numeroGeneral = parseInt(String(orden.numero_op).replace(/\D/g, ''), 10) || 0;
      if (numeroGeneral > maxOP) maxOP = numeroGeneral;

      // Escaneamos uno por uno los equipos de esta orden
      if (orden.equipos) {
        orden.equipos.forEach((e: any) => {
          const opEquipo = Number(e.orden_produccion) || 0;
          if (opEquipo > maxOP) maxOP = opEquipo;
        });
      }
    });

    // 2. Escaneamos los equipos que el usuario está añadiendo ahorita en pantalla
    if (this.nuevaOrden && this.nuevaOrden.equipos) {
      this.nuevaOrden.equipos.forEach((e: any) => {
        const opLocal = Number(e.orden_produccion) || 0;
        if (opLocal > maxOP) maxOP = opLocal;
      });
    }

    // Retornamos el número absoluto más alto + 1
    return maxOP === 0 ? 1 : maxOP + 1;
  }

  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) {
      this.cancelarEdicion();
    } else {
      // 👇 AUTOCOMPLETAMOS LA OP PADRE Y EL PRIMER EQUIPO AL INSTANTE 👇
      const consecutivo = this.calcularSiguienteOP();
      this.nuevaOrden.numero_op = String(consecutivo);
      this.nuevoEquipo.orden_produccion = consecutivo;
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

  // 👇 NUEVA FUNCIÓN: Imprime la receta con el formato elegante y el N° de OP 👇
  imprimirRecetaEquipo(): void {
    if (!this.recetaViendo || !this.recetaViendo.receta_historica) {
      this.snackBar.open('⚠️ No hay datos para imprimir', 'Cerrar', { duration: 3000 });
      return;
    }

    const equipo = this.recetaViendo;
    const numeroOP = equipo.orden_produccion || 'S/N';
    const nombreProducto = equipo.nombre_producto || equipo.descripcion;
    
    // Buscamos los datos extra en el catálogo principal
    const prodCatalogo = this.productosCatalogo.find(p => p.id_producto === equipo.id_producto);
    const tiempoFab = prodCatalogo ? prodCatalogo.tiempo_fabricacion_horas : 'N/A';
    const tipoProd = prodCatalogo ? (prodCatalogo.es_estandar ? 'Estándar (En Serie)' : 'A Medida (Especial)') : 'N/A';
    const parametrosProd = prodCatalogo?.parametro || 'No se registraron especificaciones adicionales para este equipo.';

    const costoTotal = equipo.costo_total_equipo || 0;
    const costoFormateado = costoTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Ordenamos alfabéticamente
    const recetaOrdenada = [...equipo.receta_historica].sort((a, b) => {
      const nombreA = (a.nombre_material || '').toLowerCase();
      const nombreB = (b.nombre_material || '').toLowerCase();
      return nombreA.localeCompare(nombreB);
    });

    let filasMateriales = '';
    recetaOrdenada.forEach(item => {
      // Extraemos la unidad de medida desde la bodega
      const materialBD = this.materialesBodega.find(m => m.id_material === item.id_material);
      const unidad = materialBD ? materialBD.unidad_medida : '';
      
      // Imprimimos la "cantidad_real" que es la que se usa en las Órdenes de Producción
      const cantidad = item.cantidad_real || item.cantidad_requerida || 0;

      filasMateriales += `
        <tr>
          <td style="text-align: left; padding: 10px; border: 1px solid #ccc;">${item.nombre_material}</td>
          <td style="text-align: center; padding: 10px; border: 1px solid #ccc; font-weight: bold; font-size: 1.1em;">${cantidad} ${unidad}</td>
        </tr>
      `;
    });

    const ventanaImpresion = window.open('', '_blank', 'width=900,height=700');
    if (ventanaImpresion) {
      ventanaImpresion.document.write(`
        <html>
          <head>
            <title>Receta OP-${numeroOP} - ${nombreProducto}</title>
            <style>
              body { font-family: 'Arial', sans-serif; padding: 20px; color: #333; margin: 0; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1976d2; padding-bottom: 15px; margin-bottom: 20px; }
              .header img { height: 60px; }
              .header-text { text-align: right; }
              .header-text h1 { margin: 0; color: #1976d2; font-size: 22px; font-weight: bold; font-style: italic; }
              .header-text p { margin: 5px 0 0 0; font-size: 13px; color: #666; }
              
              /* 👇 AQUÍ AÑADIMOS EL ESTILO PARA EL NÚMERO DE OP 👇 */
              .numero-op { color: #d32f2f; font-size: 24px; font-weight: 900; margin: 5px 0; display: block; }
              
              .top-section { display: flex; justify-content: space-between; align-items: stretch; gap: 20px; margin-bottom: 20px; }
              
              .product-info { flex: 1; background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 6px solid #2e7d32; border-top: 1px solid #eee; border-right: 1px solid #eee; border-bottom: 1px solid #eee; }
              .product-info h2 { margin: 0 0 10px 0; color: #2e7d32; font-size: 18px; text-transform: uppercase; }
              .product-info p { margin: 4px 0; font-size: 14px; }
              
              .costo-box { background-color: #e8f5e9 !important; border: 2px solid #2e7d32; border-radius: 12px; padding: 15px 30px; text-align: center; display: flex; flex-direction: column; justify-content: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .costo-box-title { color: #2e7d32; font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
              .costo-box-value { color: #1b5e20; font-size: 34px; font-weight: 900; margin: 0; letter-spacing: -0.5px; }

              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
              th { background-color: #1976d2; color: white; padding: 12px; text-align: center; border: 1px solid #0d47a1; font-size: 15px; }
              tr:nth-child(even) { background-color: #f2f2f2; }
              
              .parametros-box { margin-top: 20px; padding: 15px; border: 2px dashed #1976d2; background-color: #e3f2fd; border-radius: 8px; }
              .parametros-box h3 { margin: 0 0 8px 0; color: #1565c0; font-size: 16px; text-transform: uppercase; }
              .parametros-box p { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; font-weight: 500; }

              @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="/logo.png" alt="Frigo Metal" onerror="this.style.display='none'">
              <div class="header-text">
                <h1>FRIGO METAL</h1>
                <span class="numero-op">OP N° ${numeroOP}</span>
                <p>Receta de Producción y Costos Reales</p>
                <p><b>Fecha:</b> ${new Date().toLocaleDateString('es-ES')}</p>
              </div>
            </div>

            <div class="top-section">
              <div class="product-info">
                <h2>${nombreProducto}</h2>
                <p><b>Tiempo de Fabricación Estimado:</b> ${tiempoFab} ${tiempoFab !== 'N/A' ? 'horas' : ''}</p>
                <p><b>Clasificación:</b> ${tipoProd}</p>
              </div>
              
              <div class="costo-box">
                <div class="costo-box-title">COSTO REAL DE PRODUCCIÓN</div>
                <div class="costo-box-value">$${costoFormateado}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 75%; text-align: left; padding-left: 15px;">MATERIAL REQUERIDO</th>
                  <th style="width: 25%;">CANTIDAD</th>
                </tr>
              </thead>
              <tbody>
                ${filasMateriales}
              </tbody>
            </table>

            <div class="parametros-box">
              <h3>Especificaciones Técnicas / Parámetros:</h3>
              <p>${parametrosProd}</p>
            </div>

            <script>
              window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 500); };
            </script>
          </body>
        </html>
      `);
      ventanaImpresion.document.close();
    }
  }
}