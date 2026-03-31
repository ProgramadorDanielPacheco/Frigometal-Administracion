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
import { MatIconModule } from "@angular/material/icon";

import { Usuario, UsuarioService } from '../../services/usuario';
import { OrdenPlanta, ProgramacionService, ProcesoTaller } from '../../services/programacion';
import { ProductoService } from '../../services/producto';
import { ReportesService } from '../../services/reportes';

@Component({
  selector: 'app-programacion',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule,
    MatSelectModule, MatInputModule, MatButtonModule, MatTableModule, 
    MatSnackBarModule, MatIconModule
  ],
  templateUrl: './programacion.html',
  styleUrls: ['./programacion.scss']
})
export class ProgramacionComponent implements OnInit {
  
  trabajadores: Usuario[] = [];
  productos: any[] = [];
  dataSource = new MatTableDataSource<OrdenPlanta>([]);
  columnasMostradas: string[] = ['numero_op', 'cliente', 'producto', 'cantidad', 'tiempo_total', 'estado', 'acciones'];
  
  mostrarFormulario: boolean = false;
  opEditando: OrdenPlanta | null = null;

  // 👇 LA LISTA EXACTA DE PROCESOS DE LA FOTO FÍSICA 👇
  listaProcesos: string[] = [
    'Corte Laser', 'Plegado', 'Estructura', 'Armado', 'Poliuretano', 
    'Vidrios', 'Puertas', 'Refrigeracion', 'Electrico', 'Armado Final'
  ];

  estadosPlanta: string[] = ['EN COLA', 'EN PROGRESO', 'PAUSADO', 'TERMINADO'];

  constructor(
    private usuarioService: UsuarioService,
    private programacionService: ProgramacionService,
    private productoService: ProductoService,
    private snackBar: MatSnackBar,
    private reportesService: ReportesService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.usuarioService.getUsuarios().subscribe(datos => this.trabajadores = datos);
    this.productoService.getProductos().subscribe(datos => this.productos = datos);
    this.cargarOrdenes();
  }

  cargarOrdenes(): void {
    this.programacionService.getOrdenes().subscribe(datos => {
      this.dataSource.data = datos;
      this.cdr.detectChanges();
    });
  }

  obtenerNombreProducto(idProducto: number): string {
    if (this.productos.length === 0) return 'Cargando...';
    const prod = this.productos.find(p => p.id_producto === idProducto);
    return prod ? prod.nombre : `Desconocido (#${idProducto})`;
  }

  abrirHojaTrabajo(orden: OrdenPlanta): void {
    // Clonamos profundamente para no afectar la tabla hasta guardar
    this.opEditando = JSON.parse(JSON.stringify(orden));
    
    // Aseguramos que el "Cerebro" (JSON) exista
    if (!this.opEditando!.seguimiento_procesos) {
      this.opEditando!.seguimiento_procesos = {};
    }

    // Inyectamos las filas vacías para los procesos que aún no se han llenado
    this.listaProcesos.forEach(proceso => {
      if (!this.opEditando!.seguimiento_procesos[proceso]) {
        this.opEditando!.seguimiento_procesos[proceso] = { fecha: '', hora_inicio: '', hora_fin: '', responsable: '' };
      }
    });

    this.mostrarFormulario = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cerrarHojaTrabajo(): void {
    this.mostrarFormulario = false;
    this.opEditando = null;
  }

  guardarHojaTrabajo(): void {
    if (!this.opEditando || !this.opEditando.id_op) return;

    this.snackBar.open('⏳ Guardando progreso en taller...', '', { duration: 2000 });

    this.programacionService.actualizarOrden(this.opEditando.id_op, this.opEditando).subscribe({
      next: () => {
        this.snackBar.open('✅ Hoja de trabajo actualizada', 'Excelente', { duration: 3000 });
        this.cerrarHojaTrabajo();
        this.cargarOrdenes();
      },
      error: (err) => {
        this.snackBar.open('❌ Error al guardar en base de datos', 'Cerrar', { duration: 4000 });
      }
    });
  }

  obtenerColorEstado(estado: string): string {
    switch (estado) {
      case 'TERMINADO': return '#2e7d32'; // Verde
      case 'EN PROGRESO': return '#1565c0'; // Azul
      case 'PAUSADO': return '#c62828'; // Rojo
      default: return '#e65100'; // Naranja para EN COLA
    }
  }

  // ==========================================
  // 👇 CÁLCULO DE TIEMPO TOTAL EN PLANTA 👇
  // ==========================================
  // ==========================================
// 👇 CÁLCULO DE TIEMPO TOTAL EN PLANTA 👇
// ==========================================
calcularTiempoTotalOrden(orden: OrdenPlanta | null): string {
  if (!orden || !orden.seguimiento_procesos) return '0h 0m';

  let totalMinutos = 0;

  this.listaProcesos.forEach(proceso => {
    const data = orden.seguimiento_procesos[proceso];

    if (data && data.hora_inicio && data.hora_fin) {
      const [hInicio, mInicio] = data.hora_inicio.split(':').map(Number);
      const [hFin, mFin] = data.hora_fin.split(':').map(Number);

      const minInicio = (hInicio * 60) + mInicio;
      const minFin = (hFin * 60) + mFin;

      if (minFin >= minInicio) {
        totalMinutos += (minFin - minInicio);
      } else {
        totalMinutos += ((24 * 60) - minInicio + minFin);
      }
    }
  });

  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;

  return `${horas}h ${minutos}m`;
}

  // ==========================================
  // 👇 LÓGICA DE IMPRESIÓN (FORMATO FÍSICO) 👇
  // ==========================================
  imprimirHojaTrabajo(): void {
    if (!this.opEditando) return;

    const productoNombre = this.obtenerNombreProducto(this.opEditando.id_producto);
    const orden = this.opEditando;
    const procesos = this.listaProcesos;

    // Construimos las filas de los procesos dinámicamente
    let filasProcesos = '';
    procesos.forEach(proc => {
      const procData = orden.seguimiento_procesos?.[proc] || { fecha: '', hora_inicio: '', hora_fin: '', responsable: '' };
      filasProcesos += `
        <tr>
          <td colspan="2" class="col-proceso">${proc}</td>
          <td>${procData.fecha || ''}</td>
          <td>${procData.hora_inicio || ''}</td>
          <td>${procData.hora_fin || ''}</td>
          <td colspan="2">${procData.responsable || ''}</td>
        </tr>
      `;
    });

    const ventanaImpresion = window.open('', '_blank', 'width=900,height=700');
    if (ventanaImpresion) {
      ventanaImpresion.document.write(`
        <html>
          <head>
            <title>Hoja de Taller - OP ${orden.numero_op}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                padding: 20px; 
                background: white; 
                color: black;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                border: 2px solid black; 
              }
              th, td { 
                border: 1px solid black; 
                padding: 8px 10px; 
                font-size: 14px; 
              }
              .header-cell { 
                background-color: #f0f0f0; 
                font-weight: bold; 
                font-size: 13px;
              }
              .col-proceso {
                font-weight: bold;
                color: #555;
              }
              .yellow-box { 
                background-color: #ffeb3b !important; 
                -webkit-print-color-adjust: exact; /* Fuerza a la impresora a imprimir el color amarillo */
                print-color-adjust: exact;
              }
              .logo { 
                max-height: 35px; 
                float: right; 
              }
              /* Ajustes específicos para imprimir */
              @media print {
                @page { size: portrait; margin: 1cm; }
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            <table>
              <tr>
                <td colspan="2" class="header-cell" style="width: 25%;">Cliente</td>
                <td colspan="3">${orden.cliente_nombre || ''}</td>
                <td colspan="2"><img src="/logo.png" class="logo" alt="FRIGO METAL"></td>
              </tr>
              
              <tr>
                <td class="header-cell" style="width: 10%;">OP</td>
                <td style="width: 15%;">${orden.numero_op || ''}</td>
                <td class="header-cell" style="width: 15%;">Producto</td>
                <td colspan="4">${productoNombre}</td>
              </tr>

              <tr>
                <td class="header-cell">Cant.</td>
                <td>${orden.cantidad || ''}</td>
                <td class="header-cell">Fecha entrega</td>
                <td style="width: 15%;">${orden.fecha_entrega_prevista || ''}</td>
                <td colspan="3" class="yellow-box"></td>
              </tr>

              <tr>
                <td colspan="2" style="border-right: 1px solid white;"></td>
                <td class="header-cell">FECHA INI</td>
                <td>${orden.fecha_inicio_produccion || ''}</td>
                <td class="header-cell">FECHA FIN</td>
                <td colspan="2">${orden.fecha_fin_produccion || ''}</td>
              </tr>

              <tr class="header-cell">
                <td colspan="2">Proceso</td>
                <td>fecha</td>
                <td>Hora Inicio</td>
                <td>Hora Fin</td>
                <td colspan="2">Responsable</td>
              </tr>

              ${filasProcesos}

              <tr>
                <td colspan="2" class="header-cell">Observaciones</td>
                <td colspan="5" style="height: 50px; vertical-align: top;">${orden.observaciones_taller || ''}</td>
              </tr>
            </table>

            <script>
              // Autoejecuta la impresión cuando cargue el logo
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      ventanaImpresion.document.close();
    }
  }
}