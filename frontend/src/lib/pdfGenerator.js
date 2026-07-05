import jsPDF from 'jspdf';

export function generateAndDownloadPDF(response) {
  if (!response || !response.generatedOutput) return false;

  const { generatedOutput, intent } = response;
  const isInvoice = intent === 'invoice_request';
  const { docNumber, financials, items, customer } = generatedOutput;
  
  const business = response.pipelineSteps?.[1]?.output?.business || {
    name: 'SecureVision Systems',
    type: 'CCTV & Security Solutions',
    phone: '+91 98765 43210',
    email: 'info@securevision.in',
    gst: '29AAAAA0000A1Z5',
    address: 'Indiranagar, Bengaluru, KA'
  };

  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Page size dimensions
    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

    // Colors
    const navy = [11, 17, 32];
    const cyan = [34, 211, 238];
    const gray = [100, 116, 139];
    const green = [16, 185, 129];

    // Draw header band
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(0, 0, pageWidth, 42, 'F');

    // Cyan accent line below header
    doc.setFillColor(cyan[0], cyan[1], cyan[2]);
    doc.rect(0, 42, pageWidth, 2, 'F');

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(business.name, 15, 16);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(180, 200, 220);
    doc.text(business.type, 15, 22);
    doc.text(`GST: ${business.gst}`, 15, 27);
    doc.text(`${business.phone}  |  ${business.email}`, 15, 32);

    // Doc Type Label (Invoice or Quotation)
    doc.setFontSize(18);
    doc.setTextColor(cyan[0], cyan[1], cyan[2]);
    doc.setFont('Helvetica', 'bold');
    doc.text(isInvoice ? 'TAX INVOICE' : 'QUOTATION', pageWidth - 15, 18, { align: 'right' });

    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'normal');
    doc.text(docNumber, pageWidth - 15, 25, { align: 'right' });

    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(`Date: ${dateStr}`, pageWidth - 15, 31, { align: 'right' });

    // Client details & metadata
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('BILL TO:', 15, 58);
    doc.setFont('Helvetica', 'normal');
    doc.text(customer?.name || 'Walk-in Customer', 15, 63);
    doc.setFontSize(9);
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text('Bengaluru, Karnataka', 15, 68);

    // Doc info right column
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DOCUMENT INFO:', 120, 58);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Doc Number: ${docNumber}`, 120, 63);
    doc.text(`Payment Terms: 50% Advance`, 120, 68);

    // Divider line
    doc.setDrawColor(200, 210, 220);
    doc.line(15, 75, pageWidth - 15, 75);

    // Table Headers
    let y = 84;
    doc.setFillColor(240, 244, 248);
    doc.rect(15, y - 6, pageWidth - 30, 8, 'F');
    
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('#', 18, y - 1);
    doc.text('Item Description', 28, y - 1);
    doc.text('Qty', 115, y - 1, { align: 'center' });
    doc.text('Unit Price', 145, y - 1, { align: 'right' });
    doc.text('Amount', 190, y - 1, { align: 'right' });

    // Table Rows
    doc.setFont('Helvetica', 'normal');
    items.forEach((item, idx) => {
      y += 10;
      // background tint for alternating rows
      if (idx % 2 === 1) {
        doc.setFillColor(250, 252, 254);
        doc.rect(15, y - 6, pageWidth - 30, 9, 'F');
      }
      
      doc.setTextColor(gray[0], gray[1], gray[2]);
      doc.text((idx + 1).toString(), 18, y - 1);

      doc.setTextColor(navy[0], navy[1], navy[2]);
      doc.setFont('Helvetica', 'bold');
      doc.text(item.name, 28, y - 2);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(gray[0], gray[1], gray[2]);
      doc.text(item.description || '', 28, y + 2);
      
      doc.setFontSize(9);
      doc.setTextColor(navy[0], navy[1], navy[2]);
      doc.text(item.quantity.toString(), 115, y - 1, { align: 'center' });
      doc.text(`Rs. ${item.price.toLocaleString('en-IN')}`, 145, y - 1, { align: 'right' });
      doc.text(`Rs. ${(item.price * item.quantity).toLocaleString('en-IN')}`, 190, y - 1, { align: 'right' });
      y += 2; // Extra spacer
    });

    // Totals section right side
    y += 12;
    const rightAlignX = 190;
    doc.setFontSize(9);
    doc.setTextColor(gray[0], gray[1], gray[2]);
    
    // Subtotal
    doc.text('Subtotal:', 140, y);
    doc.text(`Rs. ${financials.subtotal.toLocaleString('en-IN')}`, rightAlignX, y, { align: 'right' });

    // Loyalty discount if applied
    if (financials.discountAmount > 0) {
      y += 6;
      doc.setTextColor(green[0], green[1], green[2]);
      doc.text(`Loyalty Discount (${financials.discountPercent}%):`, 140, y);
      doc.text(`-Rs. ${financials.discountAmount.toLocaleString('en-IN')}`, rightAlignX, y, { align: 'right' });
    }

    // Tax (GST 18%)
    y += 6;
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text('GST (18%):', 140, y);
    doc.text(`Rs. ${financials.taxAmount.toLocaleString('en-IN')}`, rightAlignX, y, { align: 'right' });

    // Total final
    y += 8;
    doc.line(130, y - 4, pageWidth - 15, y - 4);
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Total Amount:', 140, y + 1);
    doc.text(`Rs. ${financials.total.toLocaleString('en-IN')}`, rightAlignX, y + 1, { align: 'right' });

    // Key terms box
    y += 20;
    doc.setFillColor(245, 248, 252);
    doc.rect(15, y, pageWidth - 30, 24, 'F');
    doc.setDrawColor(220, 230, 240);
    doc.rect(15, y, pageWidth - 30, 24, 'D');

    doc.setFontSize(8);
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFont('Helvetica', 'bold');
    doc.text('TERMS & CONDITIONS', 20, y + 5);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.text('• 50% advance payment required. Balance payment immediately after installation completion.', 20, y + 10);
    doc.text('• 1-year product and installation warranty. Valid only as per Standard policies.', 20, y + 14);
    doc.text(isInvoice ? '• Tax invoice issued under GST rules.' : '• Quotation is valid for 30 days from the date of issue.', 20, y + 18);

    // Verified footer banner
    y += 34;
    doc.setFillColor(235, 248, 242);
    doc.rect(15, y, pageWidth - 30, 8, 'F');
    doc.setTextColor(6, 95, 70);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('✓ Verified by BizPilot AI Employee Copilot workflow engine', pageWidth / 2, y + 5, { align: 'center' });

    // Save PDF
    doc.save(`SecureVision-${isInvoice ? 'INVOICE' : 'QUOTATION'}-${docNumber}.pdf`);
    return true;
  } catch (e) {
    console.error(e);
    // Fallback to HTML download
    try {
      const blob = new Blob([generatedOutput.documentHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SecureVision-${isInvoice ? 'INVOICE' : 'QUOTATION'}-${docNumber}.html`;
      a.click();
      return true;
    } catch (err) {
      console.error('Fallback HTML download failed:', err);
      return false;
    }
  }
}
