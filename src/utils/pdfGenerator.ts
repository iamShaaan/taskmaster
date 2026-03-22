import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { Invoice, UserProfile } from '../types';
import { formatCurrency } from './currencyService';

const getBase64ImageFromUrl = (imageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('No canvas context');
            
            // Draw a white background so black signatures show up clearly
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            // Fallback if crossOrigin fails (CORS block without headers)
            fetch(imageUrl)
                .then(res => res.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                })
                .catch(reject);
        };
        img.src = imageUrl;
    });
};

export const generateInvoicePDF = async (invoice: Invoice, profile: Partial<UserProfile>) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // ─── Colors ───
    const brandIndigo = [79, 70, 229] as [number, number, number]; // #4f46e5
    const brandSlate = [15, 23, 42] as [number, number, number];    // #0f172a
    const mutedSlate = [100, 116, 139] as [number, number, number];  // #64748b
    const brandEmerald = [16, 185, 129] as [number, number, number]; // #10b981

    // ─── Top Header Accent ───
    doc.setFillColor(...brandIndigo);
    doc.rect(0, 0, pageWidth, 6, 'F'); // Small sleek top colored bar

    // ─── Document Title ───
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandSlate);
    doc.text('INVOICE', 20, 28);
    
    // Tiny colored square accent
    doc.setFillColor(...brandEmerald);
    doc.rect(20, 32, 10, 3, 'F');

    // ─── Invoice Meta ───
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandSlate);
    doc.text(`Invoice #`, 20, 48);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedSlate);
    doc.text(invoice.invoice_number, 50, 48);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandSlate);
    doc.text(`Date`, 20, 54);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedSlate);
    doc.text(format(new Date(invoice.date), 'dd MMM yyyy'), 50, 54);

    if (invoice.due_date) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...brandSlate);
        doc.text(`Due Date`, 20, 60);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mutedSlate);
        doc.text(format(new Date(invoice.due_date), 'dd MMM yyyy'), 50, 60);
    }

    // ─── Company Info (Right Aligned) ───
    const companyX = pageWidth - 20;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandIndigo);
    doc.text(profile.companyName || 'TaskMaster Ecosystem', companyX, 28, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandSlate);
    doc.text(profile.fullName || profile.displayName || 'Independent Contractor', companyX, 35, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedSlate);
    doc.text(profile.professionalEmail || profile.personalEmail || '', companyX, 40, { align: 'right' });

    // ─── Bill To / Payout To Block ───
    const isClientBill = invoice.type === 'client_bill';
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(companyX - 70, 50, 70, 24, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedSlate);
    doc.text(isClientBill ? 'BILL TO' : 'PAYOUT TO', companyX - 65, 57);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandSlate);
    // Auto-wrap recipient name
    const splitRecipient = doc.splitTextToSize(invoice.recipient_name, 60);
    doc.text(splitRecipient, companyX - 65, 65);

    // ─── Table ───
    const tableData = invoice.items.map(item => [
        item.description,
        item.quantity.toString(),
        formatCurrency(item.price, invoice.currency),
        formatCurrency(item.price * item.quantity, invoice.currency)
    ]);

    autoTable(doc, {
        startY: 85,
        head: [['DESCRIPTION', 'QTY', 'PRICE', 'TOTAL']],
        body: tableData,
        theme: 'plain',
        headStyles: { 
            fillColor: [241, 245, 249], 
            textColor: brandIndigo, 
            fontStyle: 'bold', 
            fontSize: 9,
            cellPadding: { top: 6, bottom: 6, left: 4, right: 4 }
        },
        styles: { 
            fontSize: 10, 
            textColor: brandSlate, 
            cellPadding: { top: 6, bottom: 6, left: 4, right: 4 }
        },
        alternateRowStyles: {
            fillColor: [252, 253, 255]
        },
        margin: { left: 20, right: 20 },
        willDrawCell: function (data) {
            // Add a subtle bottom border to body cells
            if (data.row.section === 'body') {
                doc.setDrawColor(241, 245, 249);
                doc.setLineWidth(0.5);
                doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
            }
        }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 15;

    // ─── Total Block ───
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(companyX - 70, finalY, 70, 20, 2, 2, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedSlate);
    doc.text('TOTAL AMOUNT', companyX - 65, finalY + 13);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandEmerald);
    doc.text(formatCurrency(invoice.total_amount, invoice.currency), companyX - 5, finalY + 13, { align: 'right' });

    // ─── Note ───
    if (invoice.note) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...brandIndigo);
        doc.text('NOTE', 20, finalY + 5);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mutedSlate);
        const splitNote = doc.splitTextToSize(invoice.note, pageWidth - 120); // allow room for total box
        doc.text(splitNote, 20, finalY + 11);
        
        finalY = Math.max(finalY + 20, finalY + (splitNote.length * 6) + 10);
    } else {
        finalY = finalY + 30;
    }

    // ─── Signature ───
    if (profile.signatureURL) {
        try {
            const signatureY = finalY + 10;
            
            // Draw an ultra-light gray box to establish signature region
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(20, signatureY, 60, 30, 2, 2, 'F');
            
            // Add signature image
            const base64Img = await getBase64ImageFromUrl(profile.signatureURL);
            doc.addImage(base64Img, 'PNG', 25, signatureY + 2, 50, 20);
            
            // Line and Text
            const lineY = signatureY + 24;
            doc.setDrawColor(203, 213, 225); // slate-300
            doc.line(22, lineY, 78, lineY);
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...brandSlate);
            doc.text(profile.fullName || profile.displayName || 'Authorized Signatory', 50, lineY + 4, { align: 'center' });
            
        } catch (err) {
            console.error('Error adding signature to PDF:', err);
        }
    }

    // ─── Footer ───
    const footerY = doc.internal.pageSize.height - 15;
    doc.setDrawColor(226, 232, 240);
    doc.line(20, footerY - 5, pageWidth - 20, footerY - 5);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedSlate);
    doc.text('THANK YOU FOR YOUR BUSINESS', pageWidth / 2, footerY + 2, { 
        align: 'center',
        charSpace: 2 // Widened letter spacing for modern feel
    });

    // ─── Save ───
    doc.save(`Invoice_${invoice.invoice_number}.pdf`);
};
