import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import type { Invoice, UserProfile } from '../types';
import { formatCurrency } from './currencyService';

// Extend jsPDF with autotable types
interface jsPDFWithAutoTable extends jsPDF {
    autoTable: (options: any) => jsPDF;
}

export const generateInvoicePDF = async (invoice: Invoice, profile: Partial<UserProfile>) => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const pageWidth = doc.internal.pageSize.width;

    // ─── Header ───
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', 20, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice #: ${invoice.invoice_number}`, 20, 28);
    doc.text(`Date: ${format(new Date(invoice.date), 'dd MMM yyyy')}`, 20, 33);
    if (invoice.due_date) {
        doc.text(`Due Date: ${format(new Date(invoice.due_date), 'dd MMM yyyy')}`, 20, 38);
    }

    // ─── Company Info ───
    const companyX = pageWidth - 20;
    doc.setFont('helvetica', 'bold');
    doc.text(profile.companyName || 'TaskMaster Ecosystem', companyX, 20, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(profile.fullName || profile.displayName || '', companyX, 25, { align: 'right' });
    doc.text(profile.professionalEmail || profile.personalEmail || '', companyX, 30, { align: 'right' });

    // ─── Bill To / Payout To ───
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.type === 'client_bill' ? 'BILL TO:' : 'PAYOUT TO:', 20, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.recipient_name, 20, 62);

    // ─── Table ───
    const tableData = invoice.items.map(item => [
        item.description,
        item.quantity.toString(),
        formatCurrency(item.price, invoice.currency),
        formatCurrency(item.price * item.quantity, invoice.currency)
    ]);

    doc.autoTable({
        startY: 75,
        head: [['Description', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillStyle: 'indigo', fillColor: [79, 70, 229] }, // indigo-600
        styles: { fontSize: 10, cellPadding: 5 },
        margin: { left: 20, right: 20 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // ─── Total ───
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const totalText = `TOTAL: ${formatCurrency(invoice.total_amount, invoice.currency)}`;
    doc.text(totalText, pageWidth - 20, finalY + 10, { align: 'right' });

    // ─── Signature ───
    if (profile.signatureURL) {
        try {
            const signatureY = finalY + 30;
            doc.setFontSize(10);
            doc.text('Authorized Signature:', 20, signatureY);
            
            // Add signature image (making it transparent/inverted if needed)
            // Note: jspdf handles base64 or URL. We hope CORS allows direct URL if it's from Firebase.
            doc.addImage(profile.signatureURL, 'PNG', 20, signatureY + 5, 40, 20);
            
            const lineY = signatureY + 28;
            doc.line(20, lineY, 80, lineY);
            doc.text(profile.fullName || profile.displayName || '', 20, lineY + 5);
        } catch (err) {
            console.error('Error adding signature to PDF:', err);
        }
    }

    // ─── Footer ───
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Thank you for your business!', pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

    doc.save(`Invoice_${invoice.invoice_number}.pdf`);
};
