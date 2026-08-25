import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

import { Reunion, ReunionService, TareaReunion } from '../../services/reunion'; 
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';

@Component({
  selector: 'app-reuniones',
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatSnackBarModule, MatTableModule, MatIconModule, MatChipsModule,
    MatDividerModule, MatDatepickerModule, MatNativeDateModule
  ],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-ES' }],
  templateUrl: './reuniones.html'
})
export class ReunionesComponent implements OnInit {
  
  dataSource = new MatTableDataSource<Reunion>([]);
  columnasMostradas: string[] = ['fecha', 'motivo', 'participantes', 'compromisos', 'estado', 'acciones'];
  
  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false;
  
  nuevaReunion: Reunion = { 
    motivo: '', fecha: '', hora: '', participantes: '', estado: 'PROGRAMADA',
    detalle: '', tareas: [] 
  };

  nuevaTarea: TareaReunion = { accion: '', responsable: '', fecha_accion: '' };

  constructor(
    private reunionService: ReunionService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarReuniones();
  }

  cargarReuniones(): void {
    this.reunionService.getReuniones().subscribe({
      next: (datos) => {
        this.dataSource.data = datos;
        this.cdr.detectChanges();
      },
      error: (err) => console.error(err)
    });
  }

  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) this.cancelarEdicion();
    this.cdr.detectChanges();
  }

  editarReunion(reunion: Reunion): void {
    this.modoEdicion = true;
    this.mostrarFormulario = true;
    this.nuevaReunion = { ...reunion };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.nuevaReunion = { 
      motivo: '', fecha: '', hora: '', participantes: '', estado: 'PROGRAMADA',
      detalle: '', tareas: [] 
    };
    this.nuevaTarea = { accion: '', responsable: '', fecha_accion: '' }; // Limpiamos la temporal
  }

  agregarTareaLista(): void {
    if (this.nuevaTarea.accion.trim() === '' || this.nuevaTarea.responsable.trim() === '') {
      this.snackBar.open('⚠️ Ingresa al menos la acción y el responsable', 'Cerrar', { duration: 3000 });
      return;
    }
    
    // 👇 1. Limpiamos la fecha del calendario de la Tarea 👇
    let fechaAccionLimpia = this.nuevaTarea.fecha_accion;
    if (fechaAccionLimpia && typeof fechaAccionLimpia !== 'string') {
      fechaAccionLimpia = new Date(fechaAccionLimpia).toISOString().split('T')[0];
    }
    
    // Aseguramos que exista el array y metemos una copia de la tarea con la fecha limpia
    if (!this.nuevaReunion.tareas) this.nuevaReunion.tareas = [];
    this.nuevaReunion.tareas.push({ 
      ...this.nuevaTarea, 
      fecha_accion: fechaAccionLimpia // Inyectamos la fecha ya formateada
    });
    
    // Limpiamos los inputs para la siguiente tarea
    this.nuevaTarea = { accion: '', responsable: '', fecha_accion: '' };
  }

  eliminarTareaLista(index: number): void {
    this.nuevaReunion.tareas.splice(index, 1);
  }

  guardarReunion(): void {
    if (!this.nuevaReunion.motivo || !this.nuevaReunion.fecha || !this.nuevaReunion.hora || !this.nuevaReunion.participantes) {
      this.snackBar.open('⚠️ Todos los campos principales son obligatorios', 'Cerrar', { duration: 3000 });
      return;
    }

    // 👇 1. Creamos el payload copiando los datos 👇
    const payload = { ...this.nuevaReunion };

    // 👇 2. Limpiamos la fecha del calendario principal de la Reunión 👇
    if (payload.fecha && typeof payload.fecha !== 'string') {
      payload.fecha = new Date(payload.fecha).toISOString().split('T')[0];
    }

    // 3. Enviamos el PAYLOAD en lugar de nuevaReunion
    if (this.modoEdicion && payload.id_reunion) {
      this.reunionService.actualizarReunion(payload.id_reunion, payload).subscribe({
        next: () => {
          this.snackBar.open('✅ Reunión actualizada', 'Genial', { duration: 3000 });
          this.mostrarFormulario = false;
          this.cancelarEdicion();
          this.cargarReuniones();
        }
      });
    } else {
      this.reunionService.crearReunion(payload).subscribe({
        next: () => {
          this.snackBar.open('✅ Reunión agendada', 'Genial', { duration: 3000 });
          this.mostrarFormulario = false;
          this.cancelarEdicion();
          this.cargarReuniones();
        }
      });
    }
  }

  cambiarEstadoRapido(reunion: Reunion, nuevoEstado: string): void {
    if(!reunion.id_reunion) return;
    this.reunionService.actualizarReunion(reunion.id_reunion, { estado: nuevoEstado }).subscribe(() => {
      this.snackBar.open(`Reunión marcada como ${nuevoEstado}`, 'OK', { duration: 2000 });
      this.cargarReuniones();
    });
  }

  // 👇 NUEVA FUNCIÓN PARA IMPRIMIR LA MINUTA 👇
  imprimirReunion(reunion: Reunion): void {
    let filasTareas = '';
    
    // Armamos las filas de la tabla de tareas si es que existen
    if (reunion.tareas && reunion.tareas.length > 0) {
      reunion.tareas.forEach((t: any) => {
        filasTareas += `
          <tr>
            <td style="text-align: left; padding: 10px; border: 1px solid #ccc;">${t.accion}</td>
            <td style="text-align: center; padding: 10px; border: 1px solid #ccc;">${t.responsable}</td>
            <td style="text-align: center; padding: 10px; border: 1px solid #ccc;">${t.fecha_accion || 'Sin fecha límite'}</td>
          </tr>
        `;
      });
    } else {
      filasTareas = `
        <tr>
          <td colspan="3" style="text-align: center; padding: 15px; font-style: italic; color: #777; border: 1px solid #ccc;">
            No se registraron tareas ni compromisos para esta reunión.
          </td>
        </tr>
      `;
    }

    const ventanaImpresion = window.open('', '_blank', 'width=900,height=700');
    if (ventanaImpresion) {
      ventanaImpresion.document.write(`
        <html>
          <head>
            <title>Minuta de Reunión - ${reunion.fecha}</title>
            <style>
              body { font-family: 'Arial', sans-serif; padding: 20px; color: #333; margin: 0; font-size: 14px; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1976d2; padding-bottom: 15px; margin-bottom: 20px; }
              .header img { height: 60px; }
              .header-text { text-align: right; }
              .header-text h1 { margin: 0; color: #1976d2; font-size: 22px; font-weight: bold; font-style: italic; }
              .header-text p { margin: 5px 0 0 0; font-size: 13px; color: #666; }
              
              .titulo-doc { color: #d32f2f; font-size: 20px; font-weight: 900; margin: 5px 0; display: block; text-transform: uppercase; }
              
              .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 6px solid #1976d2; border-top: 1px solid #eee; border-right: 1px solid #eee; border-bottom: 1px solid #eee; margin-bottom: 20px; }
              .info-row { display: flex; margin-bottom: 8px; }
              .info-label { font-weight: bold; width: 150px; color: #1565c0; }
              .info-value { flex: 1; }

              .detalle-box { margin-bottom: 25px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #fff; }
              .detalle-box h3 { margin-top: 0; color: #e65100; border-bottom: 1px solid #ffe0b2; padding-bottom: 5px; font-size: 16px; }
              .detalle-box p { white-space: pre-wrap; line-height: 1.5; color: #444; }

              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; }
              th { background-color: #1976d2; color: white; padding: 12px; text-align: center; border: 1px solid #0d47a1; font-size: 14px; }
              tr:nth-child(even) { background-color: #f2f2f2; }

              .signatures { display: flex; justify-content: space-around; margin-top: 60px; }
              .sig-line { width: 220px; border-top: 1px solid #333; text-align: center; padding-top: 5px; font-weight: bold; font-size: 12px; }

              @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="/logo.png" alt="Frigo Metal" onerror="this.style.display='none'">
              <div class="header-text">
                <h1>FRIGO METAL</h1>
                <span class="titulo-doc">MINUTA DE REUNIÓN</span>
                <p><b>Fecha de Impresión:</b> ${new Date().toLocaleDateString('es-ES')}</p>
              </div>
            </div>

            <div class="info-box">
              <div class="info-row"><div class="info-label">FECHA:</div><div class="info-value">${reunion.fecha || 'N/A'}</div></div>
              <div class="info-row"><div class="info-label">HORA:</div><div class="info-value">${reunion.hora || 'N/A'}</div></div>
              <div class="info-row"><div class="info-label">ESTADO:</div><div class="info-value"><strong>${reunion.estado}</strong></div></div>
              <div class="info-row"><div class="info-label">PARTICIPANTES:</div><div class="info-value">${reunion.participantes || 'N/A'}</div></div>
            </div>

            <div class="detalle-box">
              <h3>TEMA PRINCIPAL / MOTIVO</h3>
              <p><strong>${reunion.motivo}</strong></p>
              
              <h3 style="margin-top: 20px;">RESUMEN / DESARROLLO DE LA REUNIÓN</h3>
              <p>${reunion.detalle || 'No se registraron notas adicionales para esta reunión.'}</p>
            </div>

            <h3 style="color: #2e7d32; border-bottom: 2px solid #a5d6a7; padding-bottom: 5px; margin-bottom: 15px;">COMPROMISOS Y TAREAS ASIGNADAS</h3>
            <table>
              <thead>
                <tr>
                  <th style="width: 55%; text-align: left; padding-left: 15px;">ACCIÓN A REALIZAR</th>
                  <th style="width: 25%;">RESPONSABLE</th>
                  <th style="width: 20%;">FECHA LÍMITE</th>
                </tr>
              </thead>
              <tbody>
                ${filasTareas}
              </tbody>
            </table>

            <div class="signatures">
              <div class="sig-line">REGISTRADO POR</div>
              <div class="sig-line">APROBADO POR (GERENCIA)</div>
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