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

import { Reunion, ReunionService } from '../../services/reunion'; 

@Component({
  selector: 'app-reuniones',
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatSnackBarModule, MatTableModule, MatIconModule, MatChipsModule
  ],
  templateUrl: './reuniones.html'
})
export class ReunionesComponent implements OnInit {
  
  dataSource = new MatTableDataSource<Reunion>([]);
  columnasMostradas: string[] = ['fecha', 'motivo', 'participantes', 'estado', 'acciones'];
  
  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false;
  
  nuevaReunion: Reunion = { motivo: '', fecha: '', hora: '', participantes: '', estado: 'PROGRAMADA' };

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
    this.nuevaReunion = { motivo: '', fecha: '', hora: '', participantes: '', estado: 'PROGRAMADA' };
  }

  guardarReunion(): void {
    if (!this.nuevaReunion.motivo || !this.nuevaReunion.fecha || !this.nuevaReunion.hora || !this.nuevaReunion.participantes) {
      this.snackBar.open('⚠️ Todos los campos son obligatorios', 'Cerrar', { duration: 3000 });
      return;
    }

    if (this.modoEdicion && this.nuevaReunion.id_reunion) {
      this.reunionService.actualizarReunion(this.nuevaReunion.id_reunion, this.nuevaReunion).subscribe({
        next: () => {
          this.snackBar.open('✅ Reunión actualizada', 'Genial', { duration: 3000 });
          this.mostrarFormulario = false;
          this.cancelarEdicion();
          this.cargarReuniones();
        }
      });
    } else {
      this.reunionService.crearReunion(this.nuevaReunion).subscribe({
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