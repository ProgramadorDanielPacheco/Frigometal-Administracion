import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatMenu, MatMenuTrigger } from '@angular/material/menu';
import { Usuario, UsuarioService } from '../../services/usuario';
import { OrdenTrabajo, ProgramacionService } from '../../services/programacion';
import { PedidoService } from '../../services/pedido';
import { ReportesService } from '../../services/reportes';
import { MatIcon } from "@angular/material/icon";
import { ProductoService } from '../../services/producto';
import { ClienteService } from '../../services/cliente';

@Component({
  selector: 'app-programacion',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule,
    MatSelectModule, MatInputModule, MatButtonModule, MatTableModule, MatSnackBarModule, MatMenu,
    MatIcon, MatMenuTrigger
  ],
  templateUrl: './programacion.html',
  styleUrls: ['./programacion.scss']
})
export class ProgramacionComponent implements OnInit {
  trabajadores: Usuario[] = [];
  dataSource = new MatTableDataSource<OrdenTrabajo>([]);
  columnasMostradas: string[] = ['id_orden', 'id_detalle', 'trabajador', 'fecha_inicio', 'fecha_entrega', 'estado'];
  detallesPendientes: any[] = [];
  productos: any[] = [];
  clientes: any[] = [];

  // Variables del formulario
  idDetallePedido: number | null = null;
  idTrabajador: string = '';
  fechaInicio: string = '';
  fechaEntrega: string = '';

  constructor(
    private usuarioService: UsuarioService,
    private programacionService: ProgramacionService,
    private snackBar: MatSnackBar,
    private reportesService: ReportesService,
    private pedidoService: PedidoService,
    private productoService: ProductoService,
    private clienteService: ClienteService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.usuarioService.getUsuarios().subscribe(datos => this.trabajadores = datos);
    this.cargarCronograma();
    this.cargarPedidosPendientes();
    
    // Cargamos los productos al iniciar la pantalla
    this.productoService.getProductos().subscribe(datos => {
      this.productos = datos;
      this.cdr.detectChanges();
    });

    this.clienteService.getClientes().subscribe(datos => {
      this.clientes = datos;
      this.cdr.detectChanges();
    });
  }

  // ==========================================
  // 👇 NUEVA FUNCIÓN: AUTOCOMPLETAR FECHAS 👇
  // ==========================================
  onPedidoSeleccionado(): void {
    if (!this.idDetallePedido) return;

    const detalleSelec = this.detallesPendientes.find(d => d.id_detalle === this.idDetallePedido);

    if (detalleSelec && detalleSelec.fecha_entrega) {
      // 👇 Envolvemos en setTimeout para eliminar el error NG0100 👇
      setTimeout(() => {
        this.fechaEntrega = detalleSelec.fecha_entrega;

        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, '0'); 
        const dd = String(hoy.getDate()).padStart(2, '0');
        this.fechaInicio = `${yyyy}-${mm}-${dd}`;
      }, 0);
    }
  }

  // 👇 LA FUNCIÓN TRADUCTORA
  obtenerNombreProducto(idProducto: number): string {
    if (this.productos.length === 0) return 'Cargando producto...';
    
    // Buscamos el producto que coincida con el ID
    const prod = this.productos.find(p => p.id_producto === idProducto);
    return prod ? prod.nombre : `Producto Desconocido (#${idProducto})`;
  }

  obtenerNombreCliente(idCliente: any): string {
    if (!idCliente) return 'Desconocido';
    if (this.clientes.length === 0) return 'Cargando...';

    const idLimpio = String(idCliente).trim();
    const cliente = this.clientes.find(c => String(c.id_cliente).trim() === idLimpio);

    return cliente ? cliente.nombre : `Desconocido`;
  }

  cargarCronograma(): void {
    this.programacionService.getOrdenes().subscribe(datos => this.dataSource.data = datos);
  }

  asignarTrabajador(): void {
    if (!this.idDetallePedido || !this.idTrabajador || !this.fechaInicio || !this.fechaEntrega) {
      this.snackBar.open('⚠️ Completa todos los campos', 'Cerrar', { duration: 3000 });
      return;
    }

    const nuevaOrden: OrdenTrabajo = {
      id_detalle_pedido: this.idDetallePedido,
      id_usuario: this.idTrabajador as any, 
      fecha_inicio: this.fechaInicio,
      fecha_entrega_programada: this.fechaEntrega
    };

    this.programacionService.crearOrden(nuevaOrden).subscribe({
      next: () => {
        this.snackBar.open('✅ Trabajo asignado correctamente', 'Excelente', { duration: 4000 });
        this.cargarCronograma(); // Refrescamos la tabla
        
        // 👇 EL TRUCO PARA CALLAR LOS ERRORES NG0100 👇
        setTimeout(() => {
          this.idDetallePedido = null;
          this.idTrabajador = '';
          this.fechaInicio = '';
          this.fechaEntrega = '';
        }, 0);
      },
      error: (err) => {
        const mensajeError = err.error?.detail || 'Error al asignar trabajador';
        this.snackBar.open(`❌ ${mensajeError}`, 'Cerrar', { duration: 8000, panelClass: ['error-snackbar'] });
      }
    });
  }

  cargarPedidosPendientes(): void {
    this.pedidoService.getPedidos().subscribe({
      next: (pedidos) => {
        this.detallesPendientes = []; 

        pedidos.forEach((pedido: any) => {
          const estado = pedido.estado?.toUpperCase() || 'PENDIENTE';
          
          if (estado !== 'ENTREGADO' && estado !== 'ENTREGADO CON ATRASO') {
            if (pedido.detalles && pedido.detalles.length > 0) {
              pedido.detalles.forEach((detalle: any) => {
                this.detallesPendientes.push({
                  id_detalle: detalle.id_detalle,
                  id_pedido: pedido.id_pedido,
                  id_cliente: pedido.id_cliente,
                  id_producto: detalle.id_producto,
                  cantidad: detalle.cantidad,
                  fecha_entrega: pedido.fecha_entrega 
                });
              });
            }
          }
        });

        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar detalles pendientes', err)
    });
  }

  descargarExcel(): void {
    const datos = this.dataSource.data;
    this.reportesService.exportarExcel(datos, 'Cronograma_Produccion_Frigometal');
  }

  obtenerColorEstado(estado: string): { color: string, fondo: string } {
    const est = estado?.toUpperCase() || 'ASIGNADO';
    switch (est) {
      case 'COMPLETADO': return { color: '#1b5e20', fondo: '#c8e6c9' }; 
      case 'EN_PROGRESO': return { color: '#0d47a1', fondo: '#bbdefb' }; 
      case 'ASIGNADO': 
      default: return { color: '#e65100', fondo: '#ffe0b2' }; 
    }
  }

  cambiarEstado(orden: any, nuevoEstado: string): void {
    this.programacionService.actualizarEstadoOrden(orden.id_orden_trabajo, nuevoEstado).subscribe({
      next: () => {
        this.snackBar.open(`✅ Orden marcada como: ${nuevoEstado}`, 'Cerrar', { duration: 3000 });
        orden.estado = nuevoEstado; 
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('❌ Error al actualizar la orden', 'Cerrar', { duration: 3000 });
      }
    });
  }

  descargarPDF(): void {
    const datos = this.dataSource.data;
    const columnas = ['id_orden_trabajo', 'id_detalle_pedido', 'id_usuario', 'fecha_inicio', 'fecha_entrega_programada', 'estado'];
    this.reportesService.exportarPDF(datos, columnas, 'Cronograma de Producción - Frigometal', 'Cronograma_Frigometal');
  }
}