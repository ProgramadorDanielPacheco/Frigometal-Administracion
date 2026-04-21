import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { DashboardService, ResumenDashboard } from '../../services/dashboard';
import { MantenimientoService } from '../../services/mantenimiento';
import { OrdenProduccionService } from '../../services/orden-produccion'; // 👈 NUEVO: Importamos el servicio

// Módulos de Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
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
  
  // 👇 NUEVAS VARIABLES PARA ALERTAS DE PRODUCCIÓN 👇
  ordenesAtrasadas: number = 0;
  ordenesPorVencer: number = 0;

  resumen: ResumenDashboard = {
    pedidos_activos: 0,
    alertas_inventario: 0,
    compras_pendientes: 0,
    ordenes_nuevas: 0
  };

  constructor(
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef,
    private manteService: MantenimientoService,
    private ordenService: OrdenProduccionService, // 👈 NUEVO: Lo inyectamos aquí
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
    this.revisarMantenimientos();
    this.revisarEstadoOrdenes(); // 👈 NUEVO: Llamamos a la revisión
  }

  cargarDatos(): void {
    console.log('Buscando datos frescos...');
    
    this.dashboardService.getResumen().subscribe({
      next: (datos) => {
        this.resumen = datos; 
        this.cdr.detectChanges(); 
      },
      error: (err) => console.error('Error cargando el dashboard', err)
    });
  }

  revisarMantenimientos(): void {
    this.manteService.getMantenimientos().subscribe(datos => {
      const urgentes = datos.filter(m => 
        m.estado === 'Programado' && this.esFechaCercana(m.fecha_mantenimiento)
      );
      this.mantenimientosUrgentes = urgentes.length;
      this.cdr.detectChanges();
    });
  }

  esFechaCercana(fechaStr: string): boolean {
    const fecha = new Date(fechaStr + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const diff = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return diff <= 3 && diff >= 0; 
  }

  // ==========================================
  // 👇 NUEVA FUNCIÓN: EVALUAR ÓRDENES ATRASADAS Y POR VENCER 👇
  // ==========================================
  revisarEstadoOrdenes(): void {
    this.ordenService.getOrdenes().subscribe(datos => {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0); // Limpiamos la hora para calcular días exactos

      let atrasadas = 0;
      let porVencer = 0;

      datos.forEach((orden: any) => {
        // Solo revisamos las órdenes que NO estén finalizadas y que sí tengan fecha límite
        if (!orden.finalizada && orden.fecha_entrega) {
          const fechaEntrega = new Date(orden.fecha_entrega + 'T00:00:00');
          
          // Calculamos la diferencia de días
          const diffDias = Math.ceil((fechaEntrega.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDias < 0) {
            atrasadas++; // La fecha ya pasó
          } else if (diffDias >= 0 && diffDias <= 7) {
            porVencer++; // Falta una semana o menos
          }
        }
      });

      this.ordenesAtrasadas = atrasadas;
      this.ordenesPorVencer = porVencer;
      this.cdr.detectChanges();
    });
  }

  atenderNuevasOrdenes(): void {
    this.dashboardService.marcarOrdenesComoVistas().subscribe(() => {
      this.resumen.ordenes_nuevas = 0;
      this.cdr.detectChanges();
      this.router.navigate(['/ordenes-produccion']);
    });
  }
}