import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { KpiService } from '../../services/kpi';

// 👇 1. Importaciones NATIVAS de Chart.js y NUEVO PLUGIN 👇
import { Chart, registerables } from 'chart.js';
// Importamos la anotación para la línea de meta fija
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(...registerables, annotationPlugin); // Registramos el plugin

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule, 
    MatInputModule, MatButtonModule, MatSnackBarModule
  ],
  templateUrl: './estadisticas.html'
})
export class EstadisticasComponent implements OnInit {

  semanaActual: number = 0;
  anioActual: number = new Date().getFullYear();
  semanaSeleccionada: number = 0;
  
  formIngresos = { meta: 0, ingresos: 0, egresos: 0 };
  formProductividad = { meta_planchas: 0, planchas_usadas: 0 };

  graficoIngresos: any;
  graficoProductividad: any;

  // 👇 ELIMINAMOS EL PLUGIN DE TEXTO ENCIMA PARA LIMPIAR LA GRÁFICA 👇
  // (Si quieres volver a verlo, usa el código del turn anterior)

  constructor(private kpiService: KpiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.semanaActual = this.calcularSemanaDelAno(new Date());
    this.cargarGraficos();
  }

  calcularSemanaDelAno(fecha: Date): number {
    const primerDiaAno = new Date(fecha.getFullYear(), 0, 1);
    const dias = Math.floor((fecha.getTime() - primerDiaAno.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((fecha.getDay() + 1 + dias) / 7);
  }

  cargarGraficos(): void {
    // ==========================================
    // 1. GRÁFICO DE INGRESOS (Finanzas)
    // ==========================================
    this.kpiService.getIngresos().subscribe(datos => {
      if (datos.length === 0) return;

      const labels = datos.map(d => `Sem ${d.semana}`);
      const netos = datos.map(d => d.neto);
      const metaFijaValue = datos[datos.length - 1].meta;

      // 👇 LÓGICA DE COLORES DINÁMICA 👇
      const colores = datos.map(d => {
        if (Number(d.neto) < Number(d.meta)) return 'rgba(244, 67, 54, 0.8)';   // Rojo (Bajo meta)
        if (Number(d.neto) === Number(d.meta)) return 'rgba(255, 193, 7, 0.8)'; // Amarillo (Igual a meta)
        return 'rgba(76, 175, 80, 0.8)';                                      // Verde (Supera meta)
      });

      if (this.graficoIngresos) { this.graficoIngresos.destroy(); }

      this.graficoIngresos = new Chart('canvasIngresos', {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{ 
            label: 'Ingreso Neto ($)', 
            data: netos, 
            backgroundColor: colores, // Aplicamos el array de colores
            borderColor: colores.map(c => c.replace('0.8', '1')), // Bordes más sólidos
            borderWidth: 1,
            barThickness: 'flex'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, grid: { color: '#e0e0e0' } },
            x: { grid: { display: false } }
          },
          plugins: {
            legend: { display: false },
            annotation: {
              annotations: {
                lineaMeta: {
                  type: 'line',
                  yMin: metaFijaValue,
                  yMax: metaFijaValue,
                  borderColor: '#333', // Negro/Gris oscuro para que resalte sobre cualquier color
                  borderWidth: 3,
                  borderDash: [6, 6], // Punteada para que parezca de gestión
                  label: {
                    content: `META: $${metaFijaValue}`,
                    display: true,
                    position: 'end',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    font: { weight: 'bold' }
                  }
                }
              }
            }
          }
        }
      });
    });

    // ==========================================
    // 2. GRÁFICO DE PRODUCTIVIDAD (Materiales)
    // ==========================================
    this.kpiService.getProductividad().subscribe(datos => {
      if (datos.length === 0) return;

      const labels = datos.map(d => `Sem ${d.semana}`);
      const usadas = datos.map(d => d.planchas_usadas);
      const metaFijaValue = datos[datos.length - 1].meta_planchas;

      // 👇 LÓGICA DE COLORES DINÁMICA 👇
      const coloresProd = datos.map(d => {
        if (Number(d.planchas_usadas) < Number(d.meta_planchas)) return 'rgba(244, 67, 54, 0.8)'; 
        if (Number(d.planchas_usadas) === Number(d.meta_planchas)) return 'rgba(255, 193, 7, 0.8)'; 
        return 'rgba(76, 175, 80, 0.8)'; 
      });

      if (this.graficoProductividad) { this.graficoProductividad.destroy(); }

      this.graficoProductividad = new Chart('canvasProductividad', {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{ 
            label: 'Planchas Usadas', 
            data: usadas, 
            backgroundColor: coloresProd,
            borderColor: coloresProd.map(c => c.replace('0.8', '1')),
            borderWidth: 1,
            barThickness: 'flex'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, grid: { color: '#e0e0e0' } },
            x: { grid: { display: false } }
          },
          plugins: {
            legend: { display: false },
            annotation: {
              annotations: {
                lineaMeta: {
                  type: 'line',
                  yMin: metaFijaValue,
                  yMax: metaFijaValue,
                  borderColor: '#333',
                  borderWidth: 3,
                  borderDash: [6, 6],
                  label: {
                    content: `META: ${metaFijaValue} Planchas`,
                    display: true,
                    position: 'end',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    font: { weight: 'bold' }
                  }
                }
              }
            }
          }
        }
      });
    });
  }

  // Las funciones de guardar se mantienen exactamente igual
  guardarIngresos(): void {
    const payload = { 
      semana: this.semanaSeleccionada, // 👈 Usamos la variable del input
      anio: this.anioActual, 
      ...this.formIngresos 
    };
    this.kpiService.guardarIngresos(payload).subscribe(() => {
      this.snackBar.open(`✅ Ingresos de la Semana ${this.semanaSeleccionada} registrados`, 'OK', { duration: 3000 });
      this.cargarGraficos();
    });
  }
  guardarProductividad(): void {
    const payload = { 
      semana: this.semanaSeleccionada, // 👈 Usamos la variable del input
      anio: this.anioActual, 
      ...this.formProductividad 
    };
    this.kpiService.guardarProductividad(payload).subscribe(() => {
      this.snackBar.open(`✅ Productividad de la Semana ${this.semanaSeleccionada} registrada`, 'OK', { duration: 3000 });
      this.cargarGraficos();
    });
  }
}