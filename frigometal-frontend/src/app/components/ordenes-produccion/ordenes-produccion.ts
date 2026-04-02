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
import { RecetaService } from '../../services/receta';
import { MaterialService } from '../../services/material';
import { Producto, ProductoService } from '../../services/producto';
// Agrega esta línea arriba con tus otros imports:
import { ProgramacionService } from '../../services/programacion';
import { ClienteService } from '../../services/cliente';

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
  columnasMostradas: string[] = ['numero_op', 'cliente', 'fecha_entrega', 'tiempo_taller', 'costo_teorico', 'costo_real', 'precio', 'saldo', 'acciones'];
  
  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false;
  idEditando: number | null = null;
  clientesDirectorio: any[] = [];
  filtroClientes: string = '';

  // 👇 NUEVA VARIABLE PARA SABER SI ESTAMOS EDITANDO UN EQUIPO 👇
  indexEditandoEquipo: number | null = null;

  nuevaOrden: any = this.obtenerModeloVacio();
  nuevoEquipo: any = { cantidad: 1, descripcion: '', orden_produccion: 1 };
  formasDePago: string[] = ['Efectivo', 'Transferencia Bancaria', 'Tarjeta de Crédito', 'Cheque'];
  productosCatalogo: Producto[] = [];
  materialesBodega: any[] = [];
  ordenesPlanta: any[] = [];
  recetaViendo: any = null; 
  indexEquipoViendoReceta: number | null = null;

  constructor(
    private ordenService: OrdenProduccionService,
    private productoService: ProductoService,     // 👈 NUEVO
    private recetaService: RecetaService,         // 👈 NUEVO
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

    // Traemos los materiales para poder ponerles nombre en la receta
    this.materialService.getMateriales().subscribe(datos => {
      this.materialesBodega = datos;
    });

    this.programacionService.getOrdenes().subscribe(datos => {
      this.ordenesPlanta = datos;
    });
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
      (c.nombre_comercial && c.nombre_comercial.toLowerCase().includes(filtro)) // 👈 Busca por nombre comercial
    );
  }

  seleccionarCliente(nombreCliente: string): void {
    const cliente = this.clientesDirectorio.find(c => c.nombre === nombreCliente);
    if (cliente) {
      // Autocompletamos los campos del formulario de la OP. 
      // ⚠️ NOTA: Verifica que estos nombres (cliente_cedula, cliente_direccion, etc.) 
      // coincidan exactamente con cómo los llamaste en tu nuevaOrden.
      this.nuevaOrden.cliente_cedula = cliente.id_cliente || ''; // Para el campo Cédula/RUC
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
    
    // Sugerimos el siguiente OP por si quiere agregarle un equipo más a esta orden vieja
    this.nuevoEquipo.orden_produccion = this.calcularSiguienteOP();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  calcularSaldo(): void {
    const precio = Number(this.nuevaOrden.precio_total) || 0;
    const abono = Number(this.nuevaOrden.valor_abono) || 0;
    this.nuevaOrden.saldo = precio - abono;
  }
  // ==========================================
  // 👇 INTEGRACIÓN CON CATÁLOGOS Y COSTOS 👇
  // ==========================================

  // 1. Cuando seleccionamos un producto de la lista, jalamos su receta
  seleccionarProductoCatalogo(idProducto: number): void {
    const prod = this.productosCatalogo.find(p => p.id_producto === idProducto);
    if (!prod) return;

    this.nuevoEquipo.id_producto = prod.id_producto;
    this.nuevoEquipo.nombre_producto = prod.nombre;
    this.nuevoEquipo.descripcion = prod.nombre; // Por si hay OPs antiguas

    this.snackBar.open('⏳ Cargando receta base...', '', { duration: 1500 });

    this.recetaService.getReceta(prod.id_producto!).subscribe({
      next: (receta) => {
        // Armamos la "Foto Histórica" de los materiales con los precios actuales
        // Armamos la "Foto Histórica" de los materiales
        this.nuevoEquipo.receta_historica = receta.map((r: any) => {
          const materialBD = this.materialesBodega.find(m => m.id_material === r.id_material);
          const precioBase = materialBD ? Number(materialBD.precio_unitario) : 0;
          const cantOriginal = Number(r.cantidad_necesaria || r.cantidad_requerida || 0);
          
          return {
            id_material: r.id_material,
            nombre_material: materialBD ? materialBD.nombre : 'Material Desconocido',
            cantidad_requerida: cantOriginal, // La receta dice "2"
            cantidad_real: cantOriginal,      // 👈 Por defecto, asumimos que usó "2", pero es editable
            precio_unitario: precioBase,      // El precio base bloqueado
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
      // 👇 Ahora multiplicamos la cantidad que ellos editan por el precio fijo 👇
      mat.subtotal = Number(mat.cantidad_real) * Number(mat.precio_unitario);
      total += mat.subtotal;
    });
    equipo.costo_total_equipo = total;
  }

  verRecetaEquipo(index: number): void {
    this.indexEquipoViendoReceta = index;
    this.recetaViendo = this.nuevaOrden.equipos[index];
    // Hacemos scroll suave hasta abajo para ver el panel de costos
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
  }

  cerrarRecetaEquipo(): void {
    this.indexEquipoViendoReceta = null;
    this.recetaViendo = null;
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

  // ==========================================
  // 👇 CÁLCULOS INDIVIDUALES POR EQUIPO 👇
  // ==========================================

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
    // costo_total_equipo ya tiene la suma de la receta con las cantidades reales
    const costoUnitario = Number(equipo.costo_total_equipo) || 0;
    return costoUnitario * (Number(equipo.cantidad) || 1);
  }

  // ==========================================
  // 👇 CÁLCULO DE TIEMPO EN TALLER (DESGLOSADO) 👇
  // ==========================================

  // Función auxiliar de minutos (Mantienes la que ya tenías)
  private calcularMinutos(fIni?: string, hIni?: string, fFin?: string, hFin?: string): number {
    if (!fIni || !hIni || !fFin || !hFin) return 0;
    const inicio = new Date(`${fIni}T${hIni}`);
    const fin = new Date(`${fFin}T${hFin}`);
    if (fin >= inicio) return (fin.getTime() - inicio.getTime()) / 60000;
    return 0;
  }

  // 1. Calcula los minutos exactos de UN SOLO equipo
  private calcularMinutosEquipo(equipo: any): number {
    if (!equipo || this.ordenesPlanta.length === 0) return 0;
    let totalMinutos = 0;
    const procesos = [ 
      'Corte Laser', 'Plegado', 'Estructura', 'Armado', 'Poliuretano', 
      'Vidrios', 'Puertas', 'Refrigeracion', 'Electrico', 'Armado Final' 
    ];
    
    const numOpMaquina = String(equipo.orden_produccion);
    const plantaMatch = this.ordenesPlanta.find(p => String(p.numero_op) === numOpMaquina);

    if (plantaMatch && plantaMatch.seguimiento_procesos) {
      procesos.forEach(proc => {
        const data = plantaMatch.seguimiento_procesos[proc];
        if (data) {
          totalMinutos += this.calcularMinutos(data.fecha_inicio_1, data.hora_inicio_1, data.fecha_fin_1, data.hora_fin_1);
          totalMinutos += this.calcularMinutos(data.fecha_inicio_2, data.hora_inicio_2, data.fecha_fin_2, data.hora_fin_2);
        }
      });
    }
    return totalMinutos;
  }

  // 2. Transforma los minutos a texto (Ej: "2h 30m") para la lista individual
  calcularTiempoEquipo(equipo: any): string {
    const mins = this.calcularMinutosEquipo(equipo);
    const horas = Math.floor(mins / 60);
    const minutos = Math.round(mins % 60);
    return `${horas}h ${minutos}m`;
  }

  // 3. Suma todos los minutos de la OP y da el gran total
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

  // ==========================================
  // 👇 SELLAR / FINALIZAR ORDEN DE PRODUCCIÓN 👇
  // ==========================================
  finalizarOrden(orden: any): void {
    const confirmar = confirm(`⚠️ ¿Estás seguro de FINALIZAR la OP ${orden.numero_op}?\n\nAl hacerlo, los productos, cantidades y costos quedarán BLOQUEADOS permanentemente para proteger la información financiera. (Podrás seguir editando datos del cliente).`);
    
    if (confirmar) {
      this.snackBar.open('⏳ Bloqueando productos y sellando OP...', '', { duration: 2000 });
      
      this.ordenService.actualizarOrden(orden.id_orden, { finalizada: true }).subscribe({
        next: () => {
          this.snackBar.open('🔒 Orden Finalizada y Sellada con éxito', 'Cerrar', { duration: 4000 });
          this.cargarOrdenes(); // Recarga la tabla para mostrar el candado
        },
        error: (err) => {
          this.snackBar.open('❌ Error al finalizar la orden', 'Cerrar', { duration: 3000 });
        }
      });
    }
  }
}