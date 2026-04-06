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
    this.opEditando = JSON.parse(JSON.stringify(orden));
    if (!this.opEditando!.seguimiento_procesos) this.opEditando!.seguimiento_procesos = {};

    this.listaProcesos.forEach(proceso => {
      const procAnterior = this.opEditando!.seguimiento_procesos[proceso];
      if (!procAnterior) {
        this.opEditando!.seguimiento_procesos[proceso] = { 
          fecha_inicio_1: '', hora_inicio_1: '', fecha_fin_1: '', hora_fin_1: '',
          fecha_inicio_2: '', hora_inicio_2: '', fecha_fin_2: '', hora_fin_2: '',
          responsable: '',
          turnos_extra: [] // 👈 NUEVO
        };
      } else {
        // Migración de datos viejos al Turno 1 para no perder nada
        if (procAnterior.fecha_inicio && !procAnterior.fecha_inicio_1) {
          procAnterior.fecha_inicio_1 = procAnterior.fecha_inicio;
          procAnterior.hora_inicio_1 = procAnterior.hora_inicio;
          procAnterior.fecha_fin_1 = procAnterior.fecha_fin;
          procAnterior.hora_fin_1 = procAnterior.hora_fin;
        }
        if (!procAnterior.turnos_extra) {
          procAnterior.turnos_extra = [];
        }
      }
    });

    this.mostrarFormulario = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private calcularMinutos(fIni?: string, hIni?: string, fFin?: string, hFin?: string): number {
    if (!fIni || !hIni || !fFin || !hFin) return 0;
    const inicio = new Date(`${fIni}T${hIni}`);
    const fin = new Date(`${fFin}T${hFin}`);
    if (fin >= inicio) return (fin.getTime() - inicio.getTime()) / 60000;
    return 0;
  }

  cerrarHojaTrabajo(): void {
    this.mostrarFormulario = false;
    this.opEditando = null;
  }

  // ==========================================
  // 👇 GESTIÓN DE TURNOS DINÁMICOS 👇
  // ==========================================
  // ==========================================
  // 👇 GESTIÓN DE TURNOS DINÁMICOS (CORREGIDO) 👇
  // ==========================================
  agregarTurnoExtra(proceso: string): void {
    if (this.opEditando && this.opEditando.seguimiento_procesos) {
      const proc = this.opEditando.seguimiento_procesos[proceso];
      if (proc) {
        // Si no existe la lista, la creamos vacía primero
        if (!proc.turnos_extra) proc.turnos_extra = []; 
        
        proc.turnos_extra.push({
          fecha_inicio: '', hora_inicio: '', fecha_fin: '', hora_fin: ''
        });
      }
    }
  }

  eliminarTurnoExtra(proceso: string, index: number): void {
    if (this.opEditando && this.opEditando.seguimiento_procesos) {
      const proc = this.opEditando.seguimiento_procesos[proceso];
      // Verificamos que proc y turnos_extra existan antes de cortar
      if (proc && proc.turnos_extra) { 
        proc.turnos_extra.splice(index, 1);
      }
    }
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
// ==========================================
  // 👇 CÁLCULO DE TIEMPO TOTAL EN PLANTA 👇
  // ==========================================
 calcularTiempoTotalOrden(orden: OrdenPlanta | null): string {
    if (!orden || !orden.seguimiento_procesos) return '0h 0m';
    let totalMinutos = 0;

    this.listaProcesos.forEach(proceso => {
      const data = orden.seguimiento_procesos![proceso]; // 👈 Ojo con el '!'
      if (data) {
        totalMinutos += this.calcularMinutos(data.fecha_inicio_1, data.hora_inicio_1, data.fecha_fin_1, data.hora_fin_1);
        totalMinutos += this.calcularMinutos(data.fecha_inicio_2, data.hora_inicio_2, data.fecha_fin_2, data.hora_fin_2);
        
        // 👇 Sumamos los turnos extra dinámicos 👇
        if (data.turnos_extra && data.turnos_extra.length > 0) {
          data.turnos_extra.forEach((turno: any) => {
            totalMinutos += this.calcularMinutos(turno.fecha_inicio, turno.hora_inicio, turno.fecha_fin, turno.hora_fin);
          });
        }
      }
    });

    const horas = Math.floor(totalMinutos / 60);
    const minutos = Math.round(totalMinutos % 60);
    return `${horas}h ${minutos}m`;
  }
  // ==========================================
  // 👇 LÓGICA DE IMPRESIÓN (FORMATO FÍSICO) 👇
  // ==========================================
  // ==========================================
  // 👇 LÓGICA DE IMPRESIÓN (FORMATO FÍSICO) 👇
  // ==========================================
  imprimirHojaTrabajo(): void {
    if (!this.opEditando) return;

    const productoNombre = this.obtenerNombreProducto(this.opEditando.id_producto);
    const orden = this.opEditando;
    
    let filasProcesos = '';
    this.listaProcesos.forEach(proc => {
      const p = orden.seguimiento_procesos?.[proc] || {};
      
      let filasExtras = '';
      let extrasCount = p.turnos_extra ? p.turnos_extra.length : 0;
      
      // Armamos las filas extra
      if (extrasCount > 0) {
        p.turnos_extra?.forEach((t: any, index: number) => {
          filasExtras += `
            <tr>
              <td style="color: #666; font-size: 11px; background-color: #fcfcfc;">T${index + 3}</td>
              <td style="background-color: #fcfcfc;">${t.fecha_inicio || ''}</td>
              <td style="background-color: #fcfcfc;">${t.hora_inicio || ''}</td>
              <td style="background-color: #fcfcfc;">${t.fecha_fin || ''}</td>
              <td style="background-color: #fcfcfc;">${t.hora_fin || ''}</td>
            </tr>`;
        });
      }

      // El rowspan base es 2 (T1 y T2). Le sumamos los extras que existan.
      const rowspan = 2 + extrasCount;

      filasProcesos += `
        <tr>
          <td rowspan="${rowspan}" class="col-proceso" style="vertical-align: middle;">${proc}</td>
          <td style="color: #666; font-size: 11px;">T1</td>
          <td>${p.fecha_inicio_1 || ''}</td>
          <td>${p.hora_inicio_1 || ''}</td>
          <td>${p.fecha_fin_1 || ''}</td>
          <td>${p.hora_fin_1 || ''}</td>
          <td rowspan="${rowspan}" style="vertical-align: middle;">${p.responsable || ''}</td>
        </tr>
        <tr>
          <td style="color: #666; font-size: 11px; background-color: #fcfcfc;">T2</td>
          <td style="background-color: #fcfcfc;">${p.fecha_inicio_2 || ''}</td>
          <td style="background-color: #fcfcfc;">${p.hora_inicio_2 || ''}</td>
          <td style="background-color: #fcfcfc;">${p.fecha_fin_2 || ''}</td>
          <td style="background-color: #fcfcfc;">${p.hora_fin_2 || ''}</td>
        </tr>
        ${filasExtras}
      `;
    });

    const ventanaImpresion = window.open('', '_blank', 'width=1000,height=700');
    if (ventanaImpresion) {
      ventanaImpresion.document.write(`
        <html>
          <head>
            <title>Hoja de Taller - OP ${orden.numero_op}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; background: white; color: black; }
              table { width: 100%; border-collapse: collapse; border: 2px solid black; }
              th, td { border: 1px solid black; padding: 6px 4px; font-size: 12px; text-align: center; }
              .header-cell { background-color: #f0f0f0; font-weight: bold; font-size: 12px; }
              .col-proceso { font-weight: bold; color: #555; text-align: left; }
              .yellow-box { background-color: #ffeb3b !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .logo { max-height: 35px; float: right; }
              @media print { @page { size: portrait; margin: 1cm; } body { padding: 0; } }
            </style>
          </head>
          <body>
            <table>
              <tr>
                <td colspan="2" class="header-cell" style="width: 20%; text-align: left;">Cliente</td>
                <td colspan="3" style="text-align: left;">${orden.cliente_nombre || ''}</td>
                <td colspan="2"><img src="/logo.png" class="logo" alt="FRIGO METAL"></td>
              </tr>
              <tr>
                <td colspan="2" class="header-cell" style="text-align: left;">OP</td>
                <td style="text-align: left;">${orden.numero_op || ''}</td>
                <td class="header-cell" style="text-align: left;">Producto</td>
                <td colspan="3" style="text-align: left;">${productoNombre}</td>
              </tr>
              <tr>
                <td colspan="2" class="header-cell" style="text-align: left;">Cant.</td>
                <td style="text-align: left;">${orden.cantidad || ''}</td>
                <td class="header-cell" style="text-align: left;">Fecha entrega</td>
                <td style="text-align: left;">${orden.fecha_entrega_prevista || ''}</td>
                <td colspan="2" class="yellow-box"></td>
              </tr>
              <tr>
                <td colspan="3" style="border-right: 1px solid white;"></td>
                <td class="header-cell" style="text-align: left;">FECHA INI</td>
                <td style="text-align: left;">${orden.fecha_inicio_produccion || ''}</td>
                <td class="header-cell" style="text-align: left;">FECHA FIN</td>
                <td style="text-align: left;">${orden.fecha_fin_produccion || ''}</td>
              </tr>

              <tr class="header-cell">
                <td style="text-align: left;">Proceso</td>
                <td style="width: 3%;">#</td>
                <td>F. Inicio</td>
                <td>Hora Inicio</td>
                <td>F. Fin</td>
                <td>Hora Fin</td>
                <td>Responsable</td>
              </tr>
              ${filasProcesos}
              <tr>
                <td colspan="2" class="header-cell" style="text-align: left;">Observaciones</td>
                <td colspan="5" style="height: 50px; vertical-align: top; text-align: left;">${orden.observaciones_taller || ''}</td>
              </tr>
            </table>
            <script>
              window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 300); };
            </script>
          </body>
        </html>
      `);
      ventanaImpresion.document.close();
    }
  }
  // ==========================================
  // 👇 REPORTE GLOBAL DE TIEMPOS POR PROCESO 👇
  // ==========================================
  mostrarReporte: boolean = false;
  fechaInicioReporte: string = '';
  fechaFinReporte: string = '';
  reporteProcesos: { proceso: string, totalMinutos: number, totalTexto: string }[] = [];

  toggleReporte(): void {
    this.mostrarReporte = !this.mostrarReporte;
    if (!this.mostrarReporte) {
      this.fechaInicioReporte = '';
      this.fechaFinReporte = '';
      this.reporteProcesos = [];
    }
  }

  generarReporteTiempos(): void {
    if (!this.fechaInicioReporte || !this.fechaFinReporte) {
      this.snackBar.open('⚠️ Selecciona ambas fechas para calcular', 'Cerrar', { duration: 3000 });
      return;
    }

    const inicioRango = new Date(`${this.fechaInicioReporte}T00:00:00`);
    const finRango = new Date(`${this.fechaFinReporte}T23:59:59`);

    // 1. Inicializamos el mapa con todos los procesos en 0
    let mapaTiempos = new Map<string, number>();
    this.listaProcesos.forEach(p => mapaTiempos.set(p, 0));

    // 2. Recorremos TODAS las órdenes cargadas en la tabla
    this.dataSource.data.forEach(orden => {
      if (orden.seguimiento_procesos) {
        
        this.listaProcesos.forEach(proceso => {
          const data = orden.seguimiento_procesos![proceso];
          if (data) {
            // Evaluamos Turno 1
            this.sumarSiEnRango(data.fecha_inicio_1, data.hora_inicio_1, data.fecha_fin_1, data.hora_fin_1, inicioRango, finRango, proceso, mapaTiempos);
            // Evaluamos Turno 2
            this.sumarSiEnRango(data.fecha_inicio_2, data.hora_inicio_2, data.fecha_fin_2, data.hora_fin_2, inicioRango, finRango, proceso, mapaTiempos);
            
            // Evaluamos Turnos Extra
            if (data.turnos_extra && data.turnos_extra.length > 0) {
              data.turnos_extra.forEach((turno: any) => {
                this.sumarSiEnRango(turno.fecha_inicio, turno.hora_inicio, turno.fecha_fin, turno.hora_fin, inicioRango, finRango, proceso, mapaTiempos);
              });
            }
          }
        });
      }
    });

    // 3. Convertimos el mapa en un arreglo amigable para el HTML
    this.reporteProcesos = [];
    mapaTiempos.forEach((minutos, proceso) => {
      const horas = Math.floor(minutos / 60);
      const mins = Math.round(minutos % 60);
      this.reporteProcesos.push({
        proceso: proceso,
        totalMinutos: minutos,
        totalTexto: `${horas}h ${mins}m`
      });
    });
  }

  // Función auxiliar para validar fechas y sumar
  private sumarSiEnRango(fIni: string | undefined, hIni: string | undefined, fFin: string | undefined, hFin: string | undefined, inicioRango: Date, finRango: Date, proceso: string, mapaTiempos: Map<string, number>) {
    if (!fIni || !hIni || !fFin || !hFin) return;
    
    const fechaInicioTrabajo = new Date(`${fIni}T${hIni}`);
    
    // Si la fecha en la que inició el trabajo entra en nuestro rango de búsqueda, lo sumamos
    if (fechaInicioTrabajo >= inicioRango && fechaInicioTrabajo <= finRango) {
      const minutos = this.calcularMinutos(fIni, hIni, fFin, hFin);
      mapaTiempos.set(proceso, mapaTiempos.get(proceso)! + minutos);
    }
  }
}