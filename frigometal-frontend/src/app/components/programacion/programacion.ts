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
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';

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
    MatSnackBarModule, MatIconModule, MatDatepickerModule, MatNativeDateModule
  ],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-ES' }],
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

  listaProcesos: string[] = [
    'Corte Laser', 'Plegado', 'Estructura', 'Armado', 'Poliuretano', 
    'Vidrios', 'Puertas', 'Refrigeracion', 'Electrico', 'Armado Final'
  ];

  estadosPlanta: string[] = ['EN COLA', 'EN PROGRESO', 'PAUSADO', 'TERMINADO'];

  // ==========================================
  // 👇 VARIABLES DEL REPORTE 👇
  // ==========================================
  mostrarReporte: boolean = false;
  fechaInicioReporte: Date | null = null;
  fechaFinReporte: Date | null = null;
  trabajadorReporte: string = 'TODOS'; 
  reporteProcesos: { proceso: string, totalMinutos: number, totalTexto: string }[] = [];
  
  // 👇 NUEVA VARIABLE PARA EL GRAN TOTAL DEL TRABAJADOR 👇
  granTotalTextoTrabajador: string = '';

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

  abrirHojaTrabajo(orden: OrdenPlanta): void {
    this.opEditando = JSON.parse(JSON.stringify(orden));
    if (!this.opEditando!.seguimiento_procesos) this.opEditando!.seguimiento_procesos = {};

    this.listaProcesos.forEach(proceso => {
      const procData = this.opEditando!.seguimiento_procesos[proceso];
      
      if (!procData || (!procData.turnos && !procData.fecha_inicio_1 && !procData.fecha_inicio)) {
        this.opEditando!.seguimiento_procesos[proceso] = { 
          turnos: [{ fecha_inicio: '', hora_inicio: '', fecha_fin: '', hora_fin: '', responsable: '' }] 
        };
      } else {
        if (!procData.turnos) {
          procData.turnos = this.normalizarTurnos(procData);
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

  agregarTurno(proceso: string): void {
    if (this.opEditando && this.opEditando.seguimiento_procesos) {
      const proc = this.opEditando.seguimiento_procesos[proceso];
      if (proc && proc.turnos) { 
        proc.turnos.push({ fecha_inicio: '', hora_inicio: '', fecha_fin: '', hora_fin: '', responsable: '' });
      }
    }
  }

  eliminarTurno(proceso: string, index: number): void {
    if (this.opEditando && this.opEditando.seguimiento_procesos) {
      const proc = this.opEditando.seguimiento_procesos[proceso];
      if (proc && proc.turnos) { 
        proc.turnos.splice(index, 1);
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

  calcularTiempoTotalOrden(orden: OrdenPlanta | null): string {
    if (!orden || !orden.seguimiento_procesos) return '0h 0m';
    let totalMinutos = 0;

    this.listaProcesos.forEach(proceso => {
      const data = orden.seguimiento_procesos![proceso];
      if (data) {
        const turnos = this.normalizarTurnos(data);
        turnos.forEach(t => totalMinutos += this.calcularMinutos(t.fecha_inicio, t.hora_inicio, t.fecha_fin, t.hora_fin));
      }
    });

    const horas = Math.floor(totalMinutos / 60);
    const minutos = Math.round(totalMinutos % 60);
    return `${horas}h ${minutos}m`;
  }

  imprimirHojaTrabajo(): void {
    if (!this.opEditando) return;

    const productoNombre = this.obtenerNombreProducto(this.opEditando.id_producto);
    const orden = this.opEditando;
    
    let filasProcesos = '';
    this.listaProcesos.forEach(proc => {
      const p = orden.seguimiento_procesos?.[proc] || {};
      const turnos = this.normalizarTurnos(p);
      const rowspan = turnos.length > 0 ? turnos.length : 1;
      
      let filasTurnos = '';
      
      if (turnos.length === 0) {
        filasTurnos = `
          <tr>
            <td class="col-proceso" style="vertical-align: middle;">${proc}</td>
            <td colspan="6" style="text-align: center; color: gray; font-style: italic;">Sin turnos registrados</td>
          </tr>
        `;
      } else {
        turnos.forEach((t: any, index: number) => {
          if (index === 0) {
            filasTurnos += `
              <tr>
                <td rowspan="${rowspan}" class="col-proceso" style="vertical-align: middle;">${proc}</td>
                <td style="color: #666; font-size: 11px;">T${index + 1}</td>
                <td>${t.fecha_inicio || ''}</td>
                <td>${t.hora_inicio || ''}</td>
                <td>${t.fecha_fin || ''}</td>
                <td>${t.hora_fin || ''}</td>
                <td style="font-size: 10px;">${t.responsable || ''}</td>
              </tr>
            `;
          } else {
            filasTurnos += `
              <tr>
                <td style="color: #666; font-size: 11px;">T${index + 1}</td>
                <td>${t.fecha_inicio || ''}</td>
                <td>${t.hora_inicio || ''}</td>
                <td>${t.fecha_fin || ''}</td>
                <td>${t.hora_fin || ''}</td>
                <td style="font-size: 10px;">${t.responsable || ''}</td>
              </tr>
            `;
          }
        });
      }
      filasProcesos += filasTurnos;
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
                <td>Hora Ini</td>
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

  toggleReporte(): void {
    this.mostrarReporte = !this.mostrarReporte;
    if (!this.mostrarReporte) {
      this.fechaInicioReporte = null;
      this.fechaFinReporte = null;
      this.trabajadorReporte = 'TODOS'; 
      this.reporteProcesos = [];
      this.granTotalTextoTrabajador = ''; // 👈 Limpiamos también el gran total
    }
  }

  generarReporteTiempos(): void {
    if (!this.fechaInicioReporte || !this.fechaFinReporte) {
      this.snackBar.open('⚠️ Selecciona ambas fechas para calcular', 'Cerrar', { duration: 3000 });
      return;
    }

    const inicioRango = new Date(this.fechaInicioReporte);
    inicioRango.setHours(0, 0, 0, 0);
    const finRango = new Date(this.fechaFinReporte);
    finRango.setHours(23, 59, 59, 999);

    let mapaTiempos = new Map<string, number>();
    this.listaProcesos.forEach(p => mapaTiempos.set(p, 0));

    this.dataSource.data.forEach(orden => {
      if (orden.seguimiento_procesos) {
        this.listaProcesos.forEach(proceso => {
          const data = orden.seguimiento_procesos![proceso];
          if (data) {
            const turnos = this.normalizarTurnos(data);
            
            turnos.forEach(t => {
              if (this.trabajadorReporte !== 'TODOS' && t.responsable !== this.trabajadorReporte) return;
              this.sumarSiEnRango(t.fecha_inicio, t.hora_inicio, t.fecha_fin, t.hora_fin, inicioRango, finRango, proceso, mapaTiempos);
            });
          }
        });
      }
    });

    this.reporteProcesos = [];
    let sumaGranTotalMinutos = 0; // 👈 Variable auxiliar para sumar el gran total

    mapaTiempos.forEach((minutos, proceso) => {
      sumaGranTotalMinutos += minutos; // 👈 Vamos sumando todo

      const horas = Math.floor(minutos / 60);
      const mins = Math.round(minutos % 60);
      this.reporteProcesos.push({ proceso: proceso, totalMinutos: minutos, totalTexto: `${horas}h ${mins}m` });
    });

    // 👇 Calculamos y guardamos el Gran Total SOLO si se seleccionó a un trabajador específico 👇
    if (this.trabajadorReporte !== 'TODOS') {
      const horasTotales = Math.floor(sumaGranTotalMinutos / 60);
      const minsTotales = Math.round(sumaGranTotalMinutos % 60);
      this.granTotalTextoTrabajador = `${horasTotales}h ${minsTotales}m`;
    } else {
      this.granTotalTextoTrabajador = ''; // Si es 'TODOS', lo dejamos vacío para que se oculte
    }
  }

  private sumarSiEnRango(fIni: string | undefined, hIni: string | undefined, fFin: string | undefined, hFin: string | undefined, inicioRango: Date, finRango: Date, proceso: string, mapaTiempos: Map<string, number>) {
    if (!fIni || !hIni || !fFin || !hFin) return;
    
    const fechaInicioTrabajo = new Date(`${fIni}T${hIni}`);
    
    if (fechaInicioTrabajo >= inicioRango && fechaInicioTrabajo <= finRango) {
      const minutos = this.calcularMinutos(fIni, hIni, fFin, hFin);
      mapaTiempos.set(proceso, mapaTiempos.get(proceso)! + minutos);
    }
  }
}