import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Material Modules
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule, MatTableDataSource } from '@angular/material/table'; // <-- Para la tabla
import { MatIconModule } from '@angular/material/icon'; // <-- Para los botones con íconos

// Servicios
import { Cliente, ClienteService } from '../../services/cliente';
import { Producto, ProductoService } from '../../services/producto';
import { PedidoService, Pedido } from '../../services/pedido';

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    MatCardModule, MatFormFieldModule, MatSelectModule, 
    MatInputModule, MatButtonModule, MatSnackBarModule,
    MatTableModule, MatIconModule // <-- Añadidos aquí también
  ],
  templateUrl: './pedidos.html',
  styleUrls: ['./pedidos.scss'] 
})
export class PedidosComponent implements OnInit {
  // Datos para los selectores
  clientes: Cliente[] = [];
  productos: Producto[] = [];

  // Variables del formulario
  clienteSeleccionado: number | null = null;
  productoSeleccionado: number | null = null;
  cantidadPedido: number = 1;
  fechaEntrega: string = '';

  // =========================================
  // VARIABLES PARA LA TABLA Y DISEÑO
  // =========================================
  dataSource = new MatTableDataSource<any>([]);
  columnasMostradas: string[] = ['id_pedido', 'cliente', 'producto', 'cantidad', 'fecha', 'estado', 'acciones', 'Terminar'];
  mostrarFormulario: boolean = false;

  constructor(
    private clienteService: ClienteService,
    private productoService: ProductoService,
    private pedidoService: PedidoService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarPedidos();
    
    // Traemos los clientes y obligamos a la tabla a refrescarse
    this.clienteService.getClientes().subscribe(datos => {
      this.clientes = datos;
      this.cdr.detectChanges(); // <-- ¡Esta es la clave para que redibuje los nombres!
    }); 
    
    this.productoService.getProductos().subscribe(datos => {
      this.productos = datos;
      // Opcional, pero buena práctica:
      this.cdr.detectChanges(); 
    });
  }

  // Ocultar / Mostrar la tarjeta del formulario
  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    this.cdr.detectChanges();
  }

  // Traer el historial de ventas
 cargarPedidos(): void {
    this.pedidoService.getPedidos().subscribe({
      next: (datos) => {
        // 1. Mapeamos (transformamos) los datos apenas llegan
        const datosConSemaforo = datos.map(pedido => ({
          ...pedido, // Conservamos todos los datos originales
          semaforo: this.calcularEstadoTiempo(pedido) // Inyectamos el cálculo visual
        }));

        this.dataSource.data = datosConSemaforo;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar pedidos', err)
    });
  }

  // =========================================
  // LÓGICA DEL SEMÁFORO DE ENTREGAS
  // =========================================
  calcularEstadoTiempo(pedido: any): { texto: string, color: string, fondo: string } {
  if (!pedido) {
      return { texto: 'SIN FECHA', color: '#616161', fondo: '#f5f5f5' };
    }

    const estadoActual = pedido.estado?.toUpperCase() || 'PENDIENTE';

  // 1. Si ya está entregado, ignoramos el tiempo y pintamos el resultado final
  if (estadoActual === 'ENTREGADO') {
    return { texto: 'ENTREGADO', color: '#1b5e20', fondo: '#c8e6c9' }; // Verde sólido
  }
  if (estadoActual === 'ENTREGADO CON ATRASO') {
    return { texto: 'ENTREGADO CON ATRASO', color: '#b71c1c', fondo: '#ffcdd2' }; // Rojo intenso
  }

  // 2. Si sigue pendiente, calculamos el semáforo como siempre
  if (!pedido.fecha_entrega) {
    return { texto: 'SIN FECHA', color: '#616161', fondo: '#f5f5f5' }; 
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0); 

  const [anio, mes, dia] = pedido.fecha_entrega.split('-');
  const fechaLim = new Date(Number(anio), Number(mes) - 1, Number(dia));
  fechaLim.setHours(0, 0, 0, 0);

  const diferenciaMilisegundos = fechaLim.getTime() - hoy.getTime();
  const diasRestantes = Math.ceil(diferenciaMilisegundos / (1000 * 60 * 60 * 24));

  if (diasRestantes > 7) {
    return { texto: 'A TIEMPO', color: '#1b5e20', fondo: '#e8f5e9' }; 
  } else if (diasRestantes >= 0 && diasRestantes <= 7) {
    return { texto: 'POSIBLE ATRASO', color: '#e65100', fondo: '#fff3e0' }; 
  } else {
    return { texto: 'ATRASO', color: '#c62828', fondo: '#ffebee' }; 
  }
}

marcarComoEntregado(pedido: any): void {
  let estadoFinal = 'ENTREGADO'; // Asumimos que es a tiempo por defecto

  // Si tiene fecha, verificamos si hoy nos pasamos del límite
  if (pedido.fecha_entrega) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const [anio, mes, dia] = pedido.fecha_entrega.split('-');
    const fechaLim = new Date(Number(anio), Number(mes) - 1, Number(dia));
    fechaLim.setHours(0, 0, 0, 0);

    if (hoy > fechaLim) {
      estadoFinal = 'ENTREGADO CON ATRASO';
    }
  }

  // Le decimos a Python que actualice el estado en la base de datos
  this.pedidoService.actualizarEstado(pedido.id_pedido, estadoFinal).subscribe({
    next: () => {
      this.snackBar.open(`📦 Pedido marcado como: ${estadoFinal}`, 'Cerrar', { duration: 4000 });
      this.cargarPedidos(); // Recargamos la tabla para ver el nuevo color
    },
    error: (err) => {
      console.error(err);
      this.snackBar.open('❌ Error al actualizar el pedido', 'Cerrar', { duration: 3000 });
    }
  });
}
  // Guardar la nueva venta
  generarPedido(): void {
    if (!this.clienteSeleccionado || !this.productoSeleccionado || this.cantidadPedido <= 0 || !this.fechaEntrega) {
   this.snackBar.open('✅ ¡Pedido registrado como PENDIENTE!', 'Excelente', { duration: 4000 });
    return;
  }

    // Armamos el "paquete" tal como lo pide nuestro backend de FastAPI
    const nuevoPedido: any = { // Usamos 'any' por si tu interfaz Pedido no tiene la fecha definida aún
    id_cliente: this.clienteSeleccionado,
    fecha_entrega: this.fechaEntrega, // <-- ENVIAMOS LA FECHA
    detalles: [
      {
        id_producto: this.productoSeleccionado,
        cantidad: this.cantidadPedido
      }
    ]
  };

    // Enviamos el pedido a la base de datos
    this.pedidoService.crearPedido(nuevoPedido).subscribe({
      next: (respuesta) => {
        this.snackBar.open('✅ ¡Pedido creado! El inventario ha sido descontado.', 'Excelente', { duration: 4000 });
        
        // 1. Ocultamos el formulario
        this.mostrarFormulario = false;

        this.cdr.detectChanges();
        
        // 2. Refrescamos la tabla para que aparezca el nuevo pedido
        this.cargarPedidos();

        
        // 3. Limpiamos el formulario para la próxima venta
        this.clienteSeleccionado = null;
        this.productoSeleccionado = null;
        this.cantidadPedido = 1;
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('❌ Hubo un error al crear el pedido', 'Cerrar', { duration: 3000 });
      }
    });
  }

  iniciarProduccion(pedido: any): void {
  this.pedidoService.actualizarEstado(pedido.id_pedido, 'EN PRODUCCIÓN').subscribe({
    next: () => {
      this.snackBar.open('🛠️ Producción iniciada. Materiales descontados.', 'Cerrar', { duration: 4000 });
      this.cargarPedidos();
    },
    error: (err) => {
      const msg = err.error?.detail || 'Error al iniciar producción';
      this.snackBar.open(`❌ ${msg}`, 'Cerrar', { duration: 5000 });
    }
  });
}
  obtenerNombreCliente(idCliente: any): string {
    if (!idCliente) return 'Desconocido';
    
    // Si la tabla se dibuja antes de que lleguen los clientes, avisamos:
    if (this.clientes.length === 0) return 'Cargando...';
    
    // Limpiamos cualquier espacio en blanco invisible de ambos lados
    const idLimpio = String(idCliente).trim();
    const cliente = this.clientes.find(c => String(c.id_cliente).trim() === idLimpio);
    
    return cliente ? cliente.nombre : `Desconocido (${idLimpio})`;
  }

  obtenerNombreProducto(pedido: any): string {
    // Verificamos si el pedido tiene detalles guardados
    if (pedido.detalles && pedido.detalles.length > 0) {
      const idProd = pedido.detalles[0].id_producto;
      const producto = this.productos.find(p => p.id_producto === idProd);
      return producto ? producto.nombre : `Producto #${idProd}`;
    }
    return 'Sin producto';
  }

  obtenerCantidad(pedido: any): number {
    if (pedido.detalles && pedido.detalles.length > 0) {
      return pedido.detalles[0].cantidad;
    }
    return 0;
  }

  onArchivoSeleccionado(event: any): void {
    const archivo: File = event.target.files[0];
    
    if (archivo) {
      // Pequeña validación de seguridad en Angular
      if (!archivo.name.endsWith('.xlsx') && !archivo.name.endsWith('.xls')) {
        this.snackBar.open('⚠️ Por favor, selecciona un archivo de Excel válido', 'Cerrar', { duration: 3000 });
        return;
      }

      this.snackBar.open('⏳ Leyendo y subiendo archivo...', '', { duration: 2000 });

      this.pedidoService.importarPedidosExcel(archivo).subscribe({
        next: (respuesta) => {
          this.snackBar.open(`✅ ${respuesta.mensaje}`, 'Excelente', { duration: 5000 });
          
          // Si hubo filas con errores (ej. cédulas falsas o duplicados), le avisamos al usuario
          if (respuesta.errores && respuesta.errores.length > 0) {
            console.warn('Detalle de errores:', respuesta.errores);
            alert(`Se importaron los pedidos correctamente, pero ignoramos algunas filas con errores:\n\n${respuesta.errores.join('\n')}`);
          }

          this.cargarPedidos(); // Refrescamos la tabla para ver la magia
          event.target.value = ''; // Limpiamos el botón por si quieren subir otro Excel
        },
        error: (err) => {
          console.error(err);
          const mensaje = err.error?.detail || 'Error al procesar el archivo Excel';
          this.snackBar.open(`❌ ${mensaje}`, 'Cerrar', { duration: 4000 });
          event.target.value = ''; 
        }
      });
    }
  }
}