import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { DashboardService, ResumenDashboard } from '../../services/dashboard';
import { MantenimientoService } from '../../services/mantenimiento';

// Módulos de Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button'; // <-- Agregamos el módulo para tu botón
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatButtonModule, RouterModule, CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit {
  
  mantenimientosUrgentes: number = 0;

  resumen: ResumenDashboard = {
    pedidos_activos: 0,
    alertas_inventario: 0,
    compras_pendientes: 0,
    ordenes_nuevas: 0
    
  };

  constructor(
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef, // <-- Herramienta para "despertar" a la pantalla
    private manteService: MantenimientoService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Cargamos los datos apenas entras a la pantalla
    this.cargarDatos();
    this.revisarMantenimientos();
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

  revisarMantenimientos(): void {
    this.manteService.getMantenimientos().subscribe(datos => {
      // 👇 CORRECCIÓN: Filtramos por fecha cercana Y que el estado sea 'Programado' 👇
      const urgentes = datos.filter(m => 
        m.estado === 'Programado' && this.esFechaCercana(m.fecha_mantenimiento)
      );
      this.mantenimientosUrgentes = urgentes.length;
    });
  }
  esFechaCercana(fechaStr: string): boolean {
    const fecha = new Date(fechaStr + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const diff = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    
    // Si faltan entre 0 y 3 días, es urgente
    return diff <= 3 && diff >= 0; 
  }

  atenderNuevasOrdenes(): void {
    // Apagamos la notificación en la base de datos
    this.dashboardService.marcarOrdenesComoVistas().subscribe(() => {
      // La ponemos en 0 visualmente
      this.resumen.ordenes_nuevas = 0;
      this.cdr.detectChanges();
      
      // Viajamos a la pantalla de órdenes
      this.router.navigate(['/ordenes-produccion']);
    });
  }
}