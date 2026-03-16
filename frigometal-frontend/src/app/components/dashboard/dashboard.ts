import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { DashboardService, ResumenDashboard } from '../../services/dashboard';

// Módulos de Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button'; // <-- Agregamos el módulo para tu botón
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatButtonModule, RouterModule, CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit {
  
  resumen: ResumenDashboard = {
    pedidos_activos: 0,
    alertas_inventario: 0,
    compras_pendientes: 0,
    tareas_activas: 0
  };

  constructor(
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef // <-- Herramienta para "despertar" a la pantalla
  ) {}

  ngOnInit(): void {
    // Cargamos los datos apenas entras a la pantalla
    this.cargarDatos();
  }

  // La función conectada a tu nuevo botón
  cargarDatos(): void {
    console.log('Buscando datos frescos...');
    
    this.dashboardService.getResumen().subscribe({
      next: (datos) => {
        this.resumen = datos; // Guardamos los datos
        this.cdr.detectChanges(); // <-- EL TRUCO MAGICO: Obligamos a Angular a repintar el HTML
        console.log('¡Pantalla actualizada!');
      },
      error: (err) => console.error('Error cargando el dashboard', err)
    });
  }
}