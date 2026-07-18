import { useState, useEffect } from 'react';
import {
  createStockChangeNotification,
  createRestockNotification,
  createSaleNotification,
} from './notificationStore';

// Default Product Catalog
export const DEFAULT_PRODUCTS = [
  {
    id: 'P001',
    name: 'CCTV Dome Camera',
    aliases: ['cctv', 'camera', 'cameras', 'dome camera'],
    category: 'Camera',
    stock: 12,
    price: 2500,
    gst: 18,
    warranty: '1 year',
    description: '2MP Full HD Dome Camera with Night Vision, IP66 Weather Resistant',
    lowStockThreshold: 5
  },
  {
    id: 'P003',
    name: 'DVR 4 Channel',
    aliases: ['dvr', 'recorder', '4 channel dvr'],
    category: 'Recorder',
    stock: 5,
    price: 4000,
    gst: 18,
    warranty: '1 year',
    description: '4 Channel DVR for CCTV recording',
    lowStockThreshold: 3
  },
  {
    id: 'P006',
    name: 'CCTV Cable Roll',
    aliases: ['cable', 'wire', 'cctv cable'],
    category: 'Accessories',
    stock: 12,
    price: 1200,
    gst: 18,
    warranty: '6 months',
    description: 'CCTV cable roll for installation',
    lowStockThreshold: 4
  },
  {
    id: 'S001',
    name: 'Installation Service',
    aliases: ['installation', 'install', 'fitting', 'service'],
    category: 'Service',
    stock: null,
    price: 1500,
    gst: 18,
    warranty: 'N/A',
    description: 'CCTV installation and setup service',
    lowStockThreshold: null
  }
];

// Helper to calculate product status
export function calculateProductStatus(product) {
  if (product.category === 'Service' || product.stock === null || product.stock === undefined) {
    return 'Service';
  }
  if (product.stock === 0) {
    return 'Out of Stock';
  }
  if (product.stock <= (product.lowStockThreshold || 0)) {
    return 'Low Stock';
  }
  return 'Available';
}

// Helper to find a product by alias in a catalog
export function findProductByAlias(catalog, query) {
  if (!catalog || !query) return null;
  const lowercaseQuery = query.toLowerCase().trim();
  
  // 1. Direct match by ID
  let match = catalog.find(p => p.id.toLowerCase() === lowercaseQuery);
  if (match) return match;

  // 2. Direct match by Name
  match = catalog.find(p => p.name.toLowerCase() === lowercaseQuery);
  if (match) return match;

  // 3. Match by aliases
  match = catalog.find(p => 
    p.aliases && p.aliases.some(alias => 
      alias.toLowerCase() === lowercaseQuery ||
      lowercaseQuery.includes(alias.toLowerCase()) ||
      alias.toLowerCase().includes(lowercaseQuery)
    )
  );
  if (match) return match;

  // 4. Fuzzy match name
  match = catalog.find(p => p.name.toLowerCase().includes(lowercaseQuery) || lowercaseQuery.includes(p.name.toLowerCase()));
  return match || null;
}

// Helper to get low stock products
export function getLowStockProducts(catalog) {
  return catalog.filter(p => calculateProductStatus(p) === 'Low Stock');
}

// Helper to get out of stock products
export function getOutOfStockProducts(catalog) {
  return catalog.filter(p => calculateProductStatus(p) === 'Out of Stock');
}

// Get safe snapshot of catalog/history
export function getInventorySnapshot() {
  try {
    const rawProducts = localStorage.getItem('bizpilot_inventory');
    const rawHistory = localStorage.getItem('bizpilot_stock_history');
    
    let products = rawProducts ? JSON.parse(rawProducts) : DEFAULT_PRODUCTS;
    let history = rawHistory ? JSON.parse(rawHistory) : [];

    // Ensure status is appended or calculated
    const productsWithStatus = products.map(p => ({
      ...p,
      status: calculateProductStatus(p)
    }));

    return {
      products: productsWithStatus,
      stockHistory: history,
      updatedAt: new Date().toISOString(),
      source: "Inventory Dashboard"
    };
  } catch (e) {
    console.error('Error fetching inventory snapshot:', e);
    return {
      products: DEFAULT_PRODUCTS.map(p => ({ ...p, status: calculateProductStatus(p) })),
      stockHistory: [],
      updatedAt: new Date().toISOString(),
      source: "Inventory Dashboard (Fallback)"
    };
  }
}

// Custom Hook
export function useInventoryStore() {
  const [products, setProducts] = useState(() => {
    try {
      const stored = localStorage.getItem('bizpilot_inventory');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_PRODUCTS;
  });

  const [stockHistory, setStockHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('bizpilot_stock_history');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'h0',
        timestamp: new Date().toISOString(),
        productName: 'CCTV Dome Camera',
        action: 'System Seeded',
        qty: '+12',
        updatedBy: 'System'
      }
    ];
  });

  // Sync products to localStorage
  useEffect(() => {
    localStorage.setItem('bizpilot_inventory', JSON.stringify(products));
    // Trigger custom event so other listeners (if any) update
    window.dispatchEvent(new Event('bizpilot_inventory_updated'));
  }, [products]);

  // Sync history to localStorage
  useEffect(() => {
    localStorage.setItem('bizpilot_stock_history', JSON.stringify(stockHistory));
  }, [stockHistory]);

  const addHistoryEntry = (productName, action, qty, updatedBy) => {
    const entry = {
      id: 'h_' + Date.now() + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      productName,
      action,
      qty,
      updatedBy
    };
    setStockHistory(prev => [entry, ...prev]);
  };

  const addProduct = (newProd) => {
    const id = newProd.category === 'Service' 
      ? 'S00' + (products.filter(p => p.category === 'Service').length + 2)
      : 'P00' + (products.filter(p => p.category !== 'Service').length + 5);
      
    const formatted = {
      ...newProd,
      id,
      stock: newProd.category === 'Service' ? null : Number(newProd.stock),
      price: Number(newProd.price),
      gst: Number(newProd.gst),
      lowStockThreshold: newProd.category === 'Service' ? null : Number(newProd.lowStockThreshold)
    };

    setProducts(prev => [...prev, formatted]);
    addHistoryEntry(formatted.name, 'Product Created', 'N/A', 'Admin');
  };

  const updateProduct = (productId, updates) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const updated = {
          ...p,
          ...updates,
          stock: updates.category === 'Service' ? null : (updates.stock !== undefined ? Number(updates.stock) : p.stock),
          price: updates.price !== undefined ? Number(updates.price) : p.price,
          gst: updates.gst !== undefined ? Number(updates.gst) : p.gst,
          lowStockThreshold: updates.category === 'Service' ? null : (updates.lowStockThreshold !== undefined ? Number(updates.lowStockThreshold) : p.lowStockThreshold)
        };
        
        // Log changes
        if (updates.stock !== undefined && Number(updates.stock) !== p.stock && updates.category !== 'Service' && p.stock !== null) {
          const previousStock = p.stock || 0;
          const currentStock  = Number(updates.stock);
          const diff = currentStock - previousStock;
          addHistoryEntry(p.name, 'Stock Level Edited', (diff >= 0 ? '+' : '') + diff, 'Admin');
          // Create structured notification
          createStockChangeNotification(
            { ...p, lowStockThreshold: updated.lowStockThreshold },
            previousStock,
            currentStock,
            updates._reason || 'Manual correction'
          );
        } else {
          addHistoryEntry(p.name, 'Product Info Updated', 'N/A', 'Admin');
        }
        
        return updated;
      }
      return p;
    }));
  };

  const deleteProduct = (productId) => {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      setProducts(prev => prev.filter(p => p.id !== productId));
      addHistoryEntry(prod.name, 'Product Deleted', 'N/A', 'Admin');
    }
  };

  const addStock = (productId, quantity, updatedBy = 'Admin', reason = 'New stock purchased') => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId && p.category !== 'Service') {
        const previousStock = p.stock || 0;
        const newStock = previousStock + Number(quantity);
        addHistoryEntry(p.name, 'Stock Added', '+' + quantity, updatedBy);
        // Create purchase/restock notification
        createRestockNotification(p, Number(quantity), previousStock, newStock, reason);
        return { ...p, stock: newStock };
      }
      return p;
    }));
  };

  const recordStockCheck = (productId, quantity, context = "Quote") => {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      addHistoryEntry(prod.name, 'Stock Checked for ' + context, `${quantity}`, 'BizPilot AI');
    }
  };

  const recordUsage = (productId, quantity, context = 'Invoice', documentNumber = '') => {
    const prod = products.find(p => p.id === productId);
    if (prod && prod.category !== 'Service') {
      const previousStock = prod.stock || 0;
      const newStock = Math.max(0, previousStock - quantity);
      
      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
          return { ...p, stock: newStock };
        }
        return p;
      }));

      addHistoryEntry(prod.name, 'Stock Deducted for ' + context, `-${quantity}`, 'BizPilot AI');

      // Create sale notification (only for invoices, not quotes)
      if (context === 'Invoice' || context === 'Order') {
        createSaleNotification(prod, quantity, documentNumber, previousStock, newStock);
      }
    }
  };

  const getProductStats = () => {
    const activeProducts = products.map(p => ({
      ...p,
      status: calculateProductStatus(p)
    }));

    const totalProducts = activeProducts.length;
    const totalStockUnits = activeProducts.reduce((sum, p) => p.category === 'Service' ? sum : sum + (p.stock || 0), 0);
    const lowStockItems = activeProducts.filter(p => p.status === 'Low Stock').length;
    const outOfStockItems = activeProducts.filter(p => p.status === 'Out of Stock').length;

    return {
      totalProducts,
      totalStockUnits,
      lowStockItems,
      outOfStockItems
    };
  };

  const resetInventoryToDefaults = () => {
    setProducts(DEFAULT_PRODUCTS);
    setStockHistory([
      {
        id: 'h_reset_' + Date.now(),
        timestamp: new Date().toISOString(),
        productName: 'All Products',
        action: 'Inventory Reset',
        qty: 'N/A',
        updatedBy: 'Admin'
      }
    ]);
  };

  return {
    products: products.map(p => ({ ...p, status: calculateProductStatus(p) })),
    stockHistory,
    addProduct,
    updateProduct,
    deleteProduct,
    addStock,
    recordStockCheck,
    recordUsage,
    getProductStats,
    resetInventoryToDefaults
  };
}
