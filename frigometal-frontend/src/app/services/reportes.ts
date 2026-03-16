import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class ReportesService {

  constructor() { }

  // ==========================================
  // EXPORTAR A EXCEL
  // ==========================================
  exportarExcel(datos: any[], nombreArchivo: string): void {
    // 1. Convertimos el arreglo de datos en una hoja de cálculo
    const hoja: XLSX.WorkSheet = XLSX.utils.json_to_sheet(datos);
    // 2. Creamos un libro de trabajo (el archivo de Excel)
    const libro: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Reporte');
    // 3. Descargamos el archivo
    XLSX.writeFile(libro, `${nombreArchivo}.xlsx`);
  }

  // ==========================================
  // EXPORTAR A PDF
  // ==========================================
  exportarPDF(datos: any[], columnas: string[], titulo: string, nombreArchivo: string): void {
    const doc = new jsPDF();

    // Título del documento
    doc.setFontSize(18);
    doc.setTextColor(25, 118, 210); // Azul corporativo (Frigometal)
    doc.text(titulo, 14, 20);
    
    // Fecha de generación
    doc.setFontSize(10);
    doc.setTextColor(100);
    const fecha = new Date().toLocaleDateString();
    doc.text(`Generado el: ${fecha}`, 14, 28);

    // Convertimos los objetos en arreglos simples para la tabla del PDF
    const filas = datos.map(obj => columnas.map(col => obj[col]));

    // Dibujamos la tabla
    autoTable(doc, {
      head: [columnas],
      body: filas,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [25, 118, 210] } // Cabecera azul
    });

    // Descargamos el archivo
    doc.save(`${nombreArchivo}.pdf`);
  }
}