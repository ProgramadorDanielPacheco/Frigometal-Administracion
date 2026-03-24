import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { KpiService } from '../../services/kpi'; 

import { Chart, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(...registerables, annotationPlugin);

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

  anioActual: number = new Date().getFullYear();
  
  semanaIngresos: number = 0;
  semanaProductividad: number = 0;
  semanaVentas: number = 0;
  
  formIngresos = { meta: 0, ingresos: 0, egresos: 0 };
  formProductividad = { meta_planchas: 0, planchas_usadas: 0 };
  formVentas = { meta: 0, ingresos: 0};

  graficoIngresos: any;
  graficoProductividad: any;
  graficoVentas: any;

  historialIngresos: any[] = [];
  historialProductividad: any[] = [];
  historialVentas: any[] = [];

  // 👇 1. PLUGIN MEJORADO PARA DIBUJAR NÚMEROS (Incluso negativos y acumulados) 👇
  textOnTopPlugin = {
    id: 'textOnTop',
    afterDatasetsDraw(chart: any) {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset: any, i: number) => {
        const meta = chart.getDatasetMeta(i);
        meta.data.forEach((bar: any, index: number) => {
          const data = dataset.data[index];
          ctx.fillStyle = '#333';
          ctx.font = 'bold 12px Roboto';
          ctx.textAlign = 'center';
          
          // Si el valor es negativo (pérdida), dibujamos el número abajo. Si es positivo, arriba.
          const yPos = data < 0 ? bar.y + 15 : bar.y - 8;
          
          // Si es dinero, le agregamos el signo de dólar para que se vea más pro
          const texto = dataset.label.includes('$') ? `$${data}` : data;
          
          ctx.fillText(texto, bar.x, yPos);
        });
      });
    }
  };

  constructor(private kpiService: KpiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    const semActual = this.calcularSemanaDelAno(new Date());
    this.semanaIngresos = semActual;
    this.semanaProductividad = semActual;
    this.semanaVentas= semActual;
    this.cargarGraficos();
  }

  calcularSemanaDelAno(fecha: Date): number {
    const primerDiaAno = new Date(fecha.getFullYear(), 0, 1);
    const dias = Math.floor((fecha.getTime() - primerDiaAno.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((fecha.getDay() + 1 + dias) / 7);
  }

  // ==========================================
  // 👇 2. MEMORIA INTELIGENTE DE METAS 👇
  // ==========================================
  buscarIngresosPorSemana(): void {
    const dataSemana = this.historialIngresos.find(d => d.semana === this.semanaIngresos);
    if (dataSemana) {
      this.formIngresos = { meta: dataSemana.meta, ingresos: dataSemana.ingresos, egresos: dataSemana.egresos };
    } else {
      // Si la semana no existe, jalamos la última meta conocida del historial
      const ultimaMeta = this.historialIngresos.length > 0 ? this.historialIngresos[this.historialIngresos.length - 1].meta : 0;
      this.formIngresos = { meta: ultimaMeta, ingresos: 0, egresos: 0 }; 
    }
  }

  buscarProductividadPorSemana(): void {
    const dataSemana = this.historialProductividad.find(d => d.semana === this.semanaProductividad);
    if (dataSemana) {
      this.formProductividad = { meta_planchas: dataSemana.meta_planchas, planchas_usadas: dataSemana.planchas_usadas };
    } else {
      const ultimaMeta = this.historialProductividad.length > 0 ? this.historialProductividad[this.historialProductividad.length - 1].meta_planchas : 0;
      this.formProductividad = { meta_planchas: ultimaMeta, planchas_usadas: 0 }; 
    }
  }

  buscarVentasPorSemana(): void {
    const dataSemana = this.historialVentas.find(d => d.semana === this.semanaVentas);
    if (dataSemana) {
      this.formVentas = { meta: dataSemana.meta, ingresos: dataSemana.ingresos };
    } else {
      const ultimaMeta = this.historialVentas.length > 0 ? this.historialVentas[this.historialVentas.length - 1].meta : 0;
      this.formVentas = { meta: ultimaMeta, ingresos: 0 }; 
    }
  }

  cargarGraficos(): void {
    // ==========================================
    // 1. GRÁFICO DE INGRESOS (CON ACUMULADO)
    // ==========================================
    this.kpiService.getIngresos().subscribe(datos => {
      this.historialIngresos = datos;
      this.buscarIngresosPorSemana();

      if (datos.length === 0) return;

      const labels = datos.map(d => `Sem ${d.semana}`);
      const netos = datos.map(d => Number(d.neto));
      const metaFijaValue = datos[datos.length - 1].meta;

      const colores: string[] = datos.map(d => {
        if (Number(d.neto) < Number(d.meta)) return 'rgba(244, 67, 54, 0.8)'; 
        if (Number(d.neto) === Number(d.meta)) return 'rgba(255, 193, 7, 0.8)'; 
        return 'rgba(76, 175, 80, 0.8)'; 
      });

      const sumaIngresos = datos.reduce((acc, curr) => acc + Number(curr.ingresos), 0);
      const sumaEgresos = datos.reduce((acc, curr) => acc + Number(curr.egresos), 0);
      const sumaMetas = datos.reduce((acc, curr) => acc + Number(curr.meta), 0);
      const netoAcumulado = sumaIngresos - sumaEgresos;

      labels.push('ACUMULADO');
      netos.push(netoAcumulado);

      if (netoAcumulado < sumaMetas) {
        colores.push('rgba(244, 67, 54, 1)'); 
      } else if (netoAcumulado === sumaMetas) {
        colores.push('rgba(255, 193, 7, 1)'); 
      } else {
        colores.push('rgba(76, 175, 80, 1)'); 
      }

      if (this.graficoIngresos) { this.graficoIngresos.destroy(); }

      this.graficoIngresos = new Chart('canvasIngresos', {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{ 
            label: 'Ingreso Neto ($)', 
            data: netos, 
            backgroundColor: colores,
            borderColor: colores.map(c => c.replace('0.8', '1')), 
            borderWidth: 2, 
            barThickness: 'flex',
            maxBarThickness: 50
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { y: { beginAtZero: true, grid: { color: '#e0e0e0' } }, x: { grid: { display: false } } },
          plugins: {
            legend: { display: false },
            annotation: {
              annotations: {
                lineaMeta: {
                  type: 'line', yMin: metaFijaValue, yMax: metaFijaValue,
                  borderColor: '#333', borderWidth: 3, borderDash: [6, 6],
                  label: { content: `META SEMANAL: $${metaFijaValue}`, display: true, position: 'start', backgroundColor: 'rgba(0, 0, 0, 0.7)', color: 'white', font: { weight: 'bold' } }
                }
              }
            }
          }
        },
        plugins: [this.textOnTopPlugin] // 👈 ACTIVAMOS EL PLUGIN AQUÍ
      });
    });

    // ==========================================
    // 2. GRÁFICO DE PRODUCTIVIDAD
    // ==========================================
    this.kpiService.getProductividad().subscribe(datos => {
      this.historialProductividad = datos;
      this.buscarProductividadPorSemana();

      if (datos.length === 0) return;

      const labels = datos.map(d => `Sem ${d.semana}`);
      const usadas = datos.map(d => d.planchas_usadas);
      const metaFijaValue = datos[datos.length - 1].meta_planchas;

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
            barThickness: 'flex',
            maxBarThickness: 50
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { y: { beginAtZero: true, grid: { color: '#e0e0e0' } }, x: { grid: { display: false } } },
          plugins: {
            legend: { display: false },
            annotation: {
              annotations: {
                lineaMeta: {
                  type: 'line', yMin: metaFijaValue, yMax: metaFijaValue,
                  borderColor: '#333', borderWidth: 3, borderDash: [6, 6],
                  label: { content: `META: ${metaFijaValue} Planchas`, display: true, position: 'end', backgroundColor: 'rgba(0, 0, 0, 0.7)', color: 'white', font: { weight: 'bold' } }
                }
              }
            }
          }
        },
        plugins: [this.textOnTopPlugin] // 👈 ACTIVAMOS EL PLUGIN AQUÍ
      });
    });

    // ==========================================
    // 3. GRÁFICO DE VENTAS
    // ==========================================
    this.kpiService.getVentas().subscribe(datos => {
      this.historialVentas = datos;
      this.buscarVentasPorSemana();

      if (datos.length === 0) return;

      const labels = datos.map(d => `Sem ${d.semana}`);
      const ingresos = datos.map(d => d.ingresos)
      const metaFijaValue = datos[datos.length - 1].meta;

      const colores = datos.map(d => {
        if (Number(d.ingresos) < Number(d.meta)) return 'rgba(244, 67, 54, 0.8)'; 
        if (Number(d.ingresos) === Number(d.meta)) return 'rgba(255, 193, 7, 0.8)'; 
        return 'rgba(76, 175, 80, 0.8)'; 
      });

      if (this.graficoVentas) { this.graficoVentas.destroy(); }

      this.graficoVentas = new Chart('canvasVentas', {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{ 
            label: 'Ingreso Ventas ($)', 
            data: ingresos, 
            backgroundColor: colores,
            borderColor: colores.map(c => c.replace('0.8', '1')),
            borderWidth: 1,
            barThickness: 'flex',
            maxBarThickness: 50
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { y: { beginAtZero: true, grid: { color: '#e0e0e0' } }, x: { grid: { display: false } } },
          plugins: {
            legend: { display: false },
            annotation: {
              annotations: {
                lineaMeta: {
                  type: 'line', yMin: metaFijaValue, yMax: metaFijaValue,
                  borderColor: '#333', borderWidth: 3, borderDash: [6, 6],
                  label: { content: `META: $${metaFijaValue}`, display: true, position: 'end', backgroundColor: 'rgba(0, 0, 0, 0.7)', color: 'white', font: { weight: 'bold' } }
                }
              }
            }
          }
        },
        plugins: [this.textOnTopPlugin] // 👈 ACTIVAMOS EL PLUGIN AQUÍ
      });
    });
  }

  // ==========================================
  // MÉTODOS DE GUARDADO
  // ==========================================
  guardarIngresos(): void {
    const payload = { semana: this.semanaIngresos, anio: this.anioActual, ...this.formIngresos };
    this.kpiService.guardarIngresos(payload).subscribe(() => {
      this.snackBar.open(`✅ Ingresos Sem. ${this.semanaIngresos} registrados con éxito`, 'OK', { duration: 3000 });
      this.cargarGraficos();
    });
  }

  guardarProductividad(): void {
    const payload = { semana: this.semanaProductividad, anio: this.anioActual, ...this.formProductividad };
    this.kpiService.guardarProductividad(payload).subscribe(() => {
      this.snackBar.open(`✅ Productividad Sem. ${this.semanaProductividad} registrada con éxito`, 'OK', { duration: 3000 });
      this.cargarGraficos();
    });
  }

  guardarVentas(): void {
    const payload = { semana: this.semanaVentas, anio: this.anioActual, ...this.formVentas };
    this.kpiService.guardarVentas(payload).subscribe(() => {
      this.snackBar.open(`✅ Ventas Sem. ${this.semanaVentas} registrados con éxito`, 'OK', { duration: 3000 });
      this.cargarGraficos();
    });
  }
}