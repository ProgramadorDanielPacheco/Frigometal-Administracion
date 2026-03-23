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
}