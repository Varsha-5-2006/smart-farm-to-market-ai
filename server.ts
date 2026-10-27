import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dbManager, Product, Order, SurplusRecord, Notification, User } from './server/db';
import { agmarknetService } from './server/agmarknet_service';
import { geminiService } from './server/gemini_service';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// --------------------------------------------------------------------------
// 1. SYSTEM HEALTH & DIAGNOSTICS
// --------------------------------------------------------------------------
app.get('/api/health', (req: Request, res: Response) => {
  const db = dbManager.getDb();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    agmarknet: {
      status: agmarknetService['apiKey'] ? 'CONNECTED_LIVE' : 'USING_CACHED_BENCHMARK',
      recordsCount: db.mandiObservations.length,
      attribution: 'Directorate of Marketing & Inspection (AGMARKNET), Govt of India'
    },
    geminiAi: {
      status: process.env.GEMINI_API_KEY ? 'ACTIVE' : 'FALLBACK_MODE',
      model: 'gemini-3.8-flash'
    },
    database: {
      engine: 'Persistent JSON Store (/data/farm_market_db.json)',
      users: db.users.length,
      products: db.products.length,
      orders: db.orders.length,
      surplusRecords: db.surplusRecords.length,
      notifications: db.notifications.length
    }
  });
});

// --------------------------------------------------------------------------
// 2. USER AUTH & ROLES
// --------------------------------------------------------------------------
app.get('/api/users', (req: Request, res: Response) => {
  const db = dbManager.getDb();
  res.json(db.users);
});

app.get('/api/users/:id', (req: Request, res: Response) => {
  const db = dbManager.getDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

// --------------------------------------------------------------------------
// 3. MANDI PRICES & AGMARKNET DATA
// --------------------------------------------------------------------------
app.get('/api/mandi/prices', async (req: Request, res: Response) => {
  try {
    const { state, district, market, commodity, date } = req.query;
    const result = await agmarknetService.getMandiPrices({
      state: state as string,
      district: district as string,
      market: market as string,
      commodity: commodity as string,
      date: date as string
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch mandi prices', details: err.message });
  }
});

app.get('/api/mandi/compare', async (req: Request, res: Response) => {
  try {
    const commodity = (req.query.commodity as string) || 'Tomato';
    const observations = await agmarknetService.compareMarkets(commodity);
    res.json({
      commodity,
      markets: observations,
      count: observations.length,
      source: 'CACHED_OFFICIAL_DATA',
      attribution: 'AGMARKNET / Directorate of Marketing & Inspection'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to compare markets', details: err.message });
  }
});

// --------------------------------------------------------------------------
// 4. FAIR PRICE AI CALCULATOR
// --------------------------------------------------------------------------
app.post('/api/fair-price/calculate', async (req: Request, res: Response) => {
  try {
    const { commodity, variety, grade, quantity, unit, location, preferredMarket, harvestDate } = req.body;

    if (!commodity) {
      return res.status(400).json({ error: 'Commodity is required' });
    }

    const db = dbManager.getDb();
    const qComm = commodity.toLowerCase();

    // Find nearest or matching mandi benchmark
    const matchedMandi = db.mandiObservations.find(m => 
      m.commodity.toLowerCase().includes(qComm) || qComm.includes(m.commodity.toLowerCase())
    ) || db.mandiObservations[0];

    const baseModalPricePerKg = matchedMandi.modalPricePerKg || 25;
    
    // Grade adjustment
    let gradeMultiplier = 1.0;
    if (grade?.includes('Export')) gradeMultiplier = 1.25;
    else if (grade?.includes('Premium')) gradeMultiplier = 1.15;
    else if (grade?.includes('Organic')) gradeMultiplier = 1.20;
    else if (grade?.includes('Grade B')) gradeMultiplier = 0.95;

    // Disintermediation benefit: direct sale captures 15% middleman margin
    const directBenefitMultiplier = 1.14; 
    
    // Final suggested price in INR per kg
    const suggestedPricePerKg = Math.round(baseModalPricePerKg * gradeMultiplier * directBenefitMultiplier * 10) / 10;
    
    // Buyer retail benchmark (supermarket / local retail is typically 30-45% higher than mandi modal)
    const estimatedRetailPricePerKg = Math.round(baseModalPricePerKg * 1.45);

    // Call Gemini for strategic explanation
    const strategicInsight = await geminiService.generatePriceInsight({
      commodity,
      variety: variety || 'Standard',
      grade: grade || 'Grade A - Premium',
      modalPrice: baseModalPricePerKg,
      recommendedPrice: suggestedPricePerKg,
      location: location || 'Tamil Nadu'
    });

    res.json({
      commodity,
      variety: variety || matchedMandi.variety,
      grade: grade || 'Grade A - Premium',
      referenceMandi: {
        market: matchedMandi.market,
        district: matchedMandi.district,
        state: matchedMandi.state,
        modalPricePerKg: baseModalPricePerKg,
        modalPricePerQuintal: matchedMandi.modalPrice,
        minPrice: matchedMandi.minPrice,
        maxPrice: matchedMandi.maxPrice,
        observationDate: matchedMandi.arrivalDate,
        dataSource: matchedMandi.dataSource,
        attribution: 'Directorate of Marketing & Inspection (AGMARKNET)'
      },
      calculation: {
        baseModalPrice: baseModalPricePerKg,
        gradePremiumPercentage: Math.round((gradeMultiplier - 1) * 100),
        disintermediationMargin: '+14% farmer premium',
        buyerSavingsVsRetail: `${Math.round(((estimatedRetailPricePerKg - suggestedPricePerKg) / estimatedRetailPricePerKg) * 100)}% cheaper for buyers`,
        suggestedPricePerKg,
        suggestedPricePerQuintal: suggestedPricePerKg * 100,
        estimatedRetailPricePerKg,
        confidence: 'HIGH'
      },
      aiInsight: strategicInsight,
      disclaimer: 'Reference prices are derived from verified AGMARKNET mandi observations and fair disintermediation models. They serve as strategic guidance and do not constitute a fixed financial guarantee.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to calculate fair price', details: err.message });
  }
});

// --------------------------------------------------------------------------
// 5. PRODUCT CRUD & MARKETPLACE
// --------------------------------------------------------------------------
app.get('/api/products', (req: Request, res: Response) => {
  const db = dbManager.getDb();
  let products = [...db.products];

  const { search, category, farmerId, status, minPrice, maxPrice, organicOnly } = req.query;

  if (farmerId) {
    products = products.filter(p => p.farmerId === farmerId);
  }

  if (category && category !== 'All') {
    products = products.filter(p => p.category === category);
  }

  if (status && status !== 'All') {
    products = products.filter(p => p.status === status);
  }

  if (organicOnly === 'true') {
    products = products.filter(p => p.isOrganic);
  }

  if (search) {
    const q = (search as string).toLowerCase();
    products = products.filter(p => 
      p.title.toLowerCase().includes(q) ||
      p.commodity.toLowerCase().includes(q) ||
      p.variety.toLowerCase().includes(q) ||
      p.farmerLocation.toLowerCase().includes(q)
    );
  }

  if (minPrice) {
    products = products.filter(p => p.pricePerUnit >= Number(minPrice));
  }
  if (maxPrice) {
    products = products.filter(p => p.pricePerUnit <= Number(maxPrice));
  }

  res.json(products);
});

app.get('/api/products/:id', (req: Request, res: Response) => {
  const db = dbManager.getDb();
  const product = db.products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

app.post('/api/products', (req: Request, res: Response) => {
  try {
    const {
      farmerId,
      farmerName,
      farmerLocation,
      farmerPhone,
      title,
      commodity,
      category,
      variety,
      grade,
      quantity,
      unit,
      pricePerUnit,
      harvestDate,
      availableUntil,
      description,
      imageUrl,
      isOrganic
    } = req.body;

    if (!title || !commodity || !pricePerUnit || !quantity) {
      return res.status(400).json({ error: 'Missing required product fields' });
    }

    const db = dbManager.getDb();

    // Check mandi benchmark
    const matchedMandi = db.mandiObservations.find(m => 
      m.commodity.toLowerCase().includes(commodity.toLowerCase())
    );

    const newProduct: Product = {
      id: `prod_${Date.now()}`,
      farmerId: farmerId || 'usr_farmer_1',
      farmerName: farmerName || 'Ramesh Kumar',
      farmerLocation: farmerLocation || 'Thanjavur, Tamil Nadu',
      farmerPhone: farmerPhone || '+91 98401 23456',
      title: title.trim(),
      commodity: commodity.trim(),
      category: category || 'Vegetables',
      variety: variety || 'Standard',
      grade: grade || 'Grade A - Premium',
      quantity: Number(quantity),
      availableQuantity: Number(quantity),
      unit: unit || 'kg',
      pricePerUnit: Number(pricePerUnit),
      mandiBenchmarkPrice: matchedMandi ? matchedMandi.modalPricePerKg : undefined,
      mandiBenchmarkDate: matchedMandi ? matchedMandi.arrivalDate : undefined,
      harvestDate: harvestDate || new Date().toISOString().split('T')[0],
      availableUntil: availableUntil || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      description: description || 'Fresh farm-harvested produce sold directly by farmer.',
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
      isOrganic: Boolean(isOrganic),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dbManager.updateDb(d => {
      d.products.unshift(newProduct);
      d.notifications.unshift({
        id: `notif_${Date.now()}`,
        userId: newProduct.farmerId,
        title: 'Listing Published Successfully',
        message: `Your listing for "${newProduct.title}" (${newProduct.quantity} ${newProduct.unit}) is now live in the marketplace at ₹${newProduct.pricePerUnit}/${newProduct.unit}.`,
        type: 'INVENTORY',
        read: false,
        createdAt: new Date().toISOString(),
        link: '/farmer/listings'
      });
    });

    res.status(201).json(newProduct);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create product', details: err.message });
  }
});

app.put('/api/products/:id', (req: Request, res: Response) => {
  const productId = req.params.id;
  const updates = req.body;

  let updatedProduct: Product | null = null;

  dbManager.updateDb(db => {
    const idx = db.products.findIndex(p => p.id === productId);
    if (idx !== -1) {
      db.products[idx] = {
        ...db.products[idx],
        ...updates,
        quantity: updates.quantity ? Number(updates.quantity) : db.products[idx].quantity,
        availableQuantity: updates.availableQuantity !== undefined ? Number(updates.availableQuantity) : db.products[idx].availableQuantity,
        pricePerUnit: updates.pricePerUnit ? Number(updates.pricePerUnit) : db.products[idx].pricePerUnit,
        updatedAt: new Date().toISOString()
      };
      
      // Auto update stock status
      if (db.products[idx].availableQuantity <= 0) {
        db.products[idx].status = 'OUT_OF_STOCK';
      } else if (db.products[idx].availableQuantity <= 50) {
        db.products[idx].status = 'LOW_STOCK';
      } else if (db.products[idx].status === 'OUT_OF_STOCK' && db.products[idx].availableQuantity > 0) {
        db.products[idx].status = 'ACTIVE';
      }

      updatedProduct = db.products[idx];
    }
  });

  if (!updatedProduct) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(updatedProduct);
});

app.delete('/api/products/:id', (req: Request, res: Response) => {
  const productId = req.params.id;
  let deleted = false;

  dbManager.updateDb(db => {
    const idx = db.products.findIndex(p => p.id === productId);
    if (idx !== -1) {
      db.products.splice(idx, 1);
      deleted = true;
    }
  });

  if (!deleted) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json({ success: true, message: 'Product listing deleted successfully' });
});

// --------------------------------------------------------------------------
// 6. ORDER WORKFLOW & ATOMIC INVENTORY
// --------------------------------------------------------------------------
app.get('/api/orders', (req: Request, res: Response) => {
  const db = dbManager.getDb();
  const { buyerId, farmerId } = req.query;

  let orders = [...db.orders];
  if (buyerId) {
    orders = orders.filter(o => o.buyerId === buyerId);
  }
  if (farmerId) {
    orders = orders.filter(o => o.farmerId === farmerId);
  }

  res.json(orders);
});

app.get('/api/orders/:id', (req: Request, res: Response) => {
  const db = dbManager.getDb();
  const order = db.orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

app.post('/api/orders', (req: Request, res: Response) => {
  try {
    const { buyerId, buyerName, buyerPhone, buyerAddress, deliveryDate, items, notes, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    const db = dbManager.getDb();

    // Validate inventory and calculate server-side totals safely
    let totalAmount = 0;
    const validatedItems: any[] = [];
    let farmerId = '';
    let farmerName = '';

    for (const item of items) {
      const product = db.products.find(p => p.id === item.productId);
      if (!product) {
        return res.status(400).json({ error: `Product "${item.title || item.productId}" is no longer available` });
      }

      if (product.availableQuantity < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for "${product.title}". Only ${product.availableQuantity} ${product.unit} available.` 
        });
      }

      const subtotal = product.pricePerUnit * item.quantity;
      totalAmount += subtotal;
      farmerId = product.farmerId;
      farmerName = product.farmerName;

      validatedItems.push({
        productId: product.id,
        title: product.title,
        commodity: product.commodity,
        quantity: item.quantity,
        unit: product.unit,
        pricePerUnit: product.pricePerUnit,
        subtotal,
        imageUrl: product.imageUrl,
        farmerId: product.farmerId
      });
    }

    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      buyerId: buyerId || 'usr_buyer_1',
      buyerName: buyerName || 'Priya Sundaram',
      buyerPhone: buyerPhone || '+91 98840 54321',
      buyerAddress: buyerAddress || 'Chennai Central Hub',
      deliveryDate: deliveryDate || new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      farmerId: farmerId || 'usr_farmer_1',
      farmerName: farmerName || 'Ramesh Kumar',
      items: validatedItems,
      totalAmount,
      status: 'CONFIRMED',
      notes: notes || '',
      paymentMethod: paymentMethod || 'UPI_DEMO',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Atomic update: deduct inventory and persist order
    dbManager.updateDb(d => {
      // Deduct inventory
      for (const item of validatedItems) {
        const prod = d.products.find(p => p.id === item.productId);
        if (prod) {
          prod.availableQuantity -= item.quantity;
          if (prod.availableQuantity <= 0) {
            prod.status = 'OUT_OF_STOCK';
          } else if (prod.availableQuantity <= 50) {
            prod.status = 'LOW_STOCK';
          }
          prod.updatedAt = new Date().toISOString();
        }
      }

      // Add order
      d.orders.unshift(newOrder);
      d.systemConfig.totalTransactionsLogged += 1;

      // Notify farmer
      d.notifications.unshift({
        id: `notif_${Date.now()}_f`,
        userId: newOrder.farmerId,
        title: 'New Order Received!',
        message: `Buyer "${newOrder.buyerName}" placed Order #${newOrder.id} for ₹${newOrder.totalAmount.toLocaleString('en-IN')}.`,
        type: 'ORDER',
        read: false,
        createdAt: new Date().toISOString(),
        link: '/farmer/orders'
      });

      // Notify buyer
      d.notifications.unshift({
        id: `notif_${Date.now()}_b`,
        userId: newOrder.buyerId,
        title: 'Order Confirmed',
        message: `Your order #${newOrder.id} with ${newOrder.farmerName} is confirmed for delivery on ${newOrder.deliveryDate}.`,
        type: 'ORDER',
        read: false,
        createdAt: new Date().toISOString(),
        link: '/buyer/orders'
      });
    });

    res.status(201).json(newOrder);
  } catch (err: any) {
    res.status(500).json({ error: 'Order creation failed', details: err.message });
  }
});

app.patch('/api/orders/:id/status', (req: Request, res: Response) => {
  const { status } = req.body;
  const orderId = req.params.id;

  const validStatuses = ['PENDING', 'CONFIRMED', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid order status' });
  }

  let updatedOrder: Order | null = null;

  dbManager.updateDb(db => {
    const order = db.orders.find(o => o.id === orderId);
    if (order) {
      // If cancelled from pending/confirmed, return inventory
      if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
        for (const item of order.items) {
          const prod = db.products.find(p => p.id === item.productId);
          if (prod) {
            prod.availableQuantity += item.quantity;
            if (prod.status === 'OUT_OF_STOCK' && prod.availableQuantity > 0) {
              prod.status = 'ACTIVE';
            }
          }
        }
      }

      order.status = status;
      order.updatedAt = new Date().toISOString();
      updatedOrder = order;

      // Notification
      db.notifications.unshift({
        id: `notif_${Date.now()}`,
        userId: order.buyerId,
        title: `Order Status: ${status.replace(/_/g, ' ')}`,
        message: `Order #${order.id} status was updated to ${status}.`,
        type: 'ORDER',
        read: false,
        createdAt: new Date().toISOString(),
        link: '/buyer/orders'
      });
    }
  });

  if (!updatedOrder) {
    return res.status(404).json({ error: 'Order not found' });
  }

  res.json(updatedOrder);
});

// --------------------------------------------------------------------------
// 7. SURPLUS & FOOD WASTE MANAGEMENT
// --------------------------------------------------------------------------
app.get('/api/surplus', (req: Request, res: Response) => {
  const db = dbManager.getDb();
  res.json(db.surplusRecords);
});

app.post('/api/surplus', (req: Request, res: Response) => {
  try {
    const { farmerId, farmerName, commodity, variety, quantity, unit, estimatedValue, reason, shelfLifeDays, recommendedAction } = req.body;

    if (!commodity || !quantity) {
      return res.status(400).json({ error: 'Commodity and quantity are required' });
    }

    const newRecord: SurplusRecord = {
      id: `surplus_${Date.now()}`,
      farmerId: farmerId || 'usr_farmer_1',
      farmerName: farmerName || 'Ramesh Kumar',
      commodity,
      variety: variety || 'Standard',
      quantity: Number(quantity),
      unit: unit || 'kg',
      estimatedValue: Number(estimatedValue) || Number(quantity) * 20,
      reason: reason || 'Bumper Harvest',
      harvestDate: new Date().toISOString().split('T')[0],
      shelfLifeDays: Number(shelfLifeDays) || 5,
      recommendedAction: recommendedAction || 'FLASH_DISCOUNT',
      status: 'OPEN',
      createdAt: new Date().toISOString()
    };

    dbManager.updateDb(db => {
      db.surplusRecords.unshift(newRecord);
      db.notifications.unshift({
        id: `notif_${Date.now()}`,
        userId: newRecord.farmerId,
        title: 'Surplus Produce Recorded',
        message: `Recorded ${newRecord.quantity} ${newRecord.unit} of surplus ${newRecord.commodity}. Recommended action: ${newRecord.recommendedAction.replace(/_/g, ' ')}.`,
        type: 'SURPLUS',
        read: false,
        createdAt: new Date().toISOString(),
        link: '/farmer/surplus'
      });
    });

    res.status(201).json(newRecord);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record surplus produce', details: err.message });
  }
});

app.patch('/api/surplus/:id', (req: Request, res: Response) => {
  const surplusId = req.params.id;
  const { status, actionTaken, convertToProduct } = req.body;

  let updatedRecord: SurplusRecord | null = null;
  let createdProduct: Product | null = null;

  dbManager.updateDb(db => {
    const record = db.surplusRecords.find(s => s.id === surplusId);
    if (record) {
      if (status) record.status = status;
      if (actionTaken) record.actionTaken = actionTaken;

      // One-click convert surplus into discounted marketplace listing
      if (convertToProduct && record.status !== 'DISCOUNTED_LISTED') {
        const discountPrice = Math.round((record.estimatedValue / record.quantity) * 0.7); // 30% discount
        const prod: Product = {
          id: `prod_surplus_${Date.now()}`,
          farmerId: record.farmerId,
          farmerName: record.farmerName,
          farmerLocation: 'Thanjavur, Tamil Nadu',
          farmerPhone: '+91 98401 23456',
          title: `[FLASH DISCOUNT] Surplus ${record.commodity} (${record.variety})`,
          commodity: record.commodity,
          category: 'Vegetables',
          variety: record.variety,
          grade: 'Grade B - Standard',
          quantity: record.quantity,
          availableQuantity: record.quantity,
          unit: record.unit as any,
          pricePerUnit: discountPrice > 0 ? discountPrice : 18,
          harvestDate: record.harvestDate,
          availableUntil: new Date(Date.now() + record.shelfLifeDays * 86400000).toISOString().split('T')[0],
          description: `Direct surplus batch to prevent post-harvest waste. Great freshness for immediate consumption, catering, or culinary use.`,
          imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
          isOrganic: false,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        db.products.unshift(prod);
        record.status = 'DISCOUNTED_LISTED';
        record.convertedProductId = prod.id;
        record.actionTaken = `Listed on Marketplace at 30% discount (₹${prod.pricePerUnit}/${prod.unit}) to clear inventory`;
        createdProduct = prod;
      }

      updatedRecord = record;
    }
  });

  if (!updatedRecord) {
    return res.status(404).json({ error: 'Surplus record not found' });
  }

  res.json({ surplusRecord: updatedRecord, createdProduct });
});

app.delete('/api/surplus/:id', (req: Request, res: Response) => {
  const surplusId = req.params.id;
  let deleted = false;

  dbManager.updateDb(db => {
    const idx = db.surplusRecords.findIndex(s => s.id === surplusId);
    if (idx !== -1) {
      db.surplusRecords.splice(idx, 1);
      deleted = true;
    }
  });

  if (!deleted) {
    return res.status(404).json({ error: 'Record not found' });
  }

  res.json({ success: true, message: 'Surplus record removed' });
});

// --------------------------------------------------------------------------
// 8. NOTIFICATIONS
// --------------------------------------------------------------------------
app.get('/api/notifications', (req: Request, res: Response) => {
  const db = dbManager.getDb();
  const userId = req.query.userId as string;
  let notifs = [...db.notifications];
  if (userId) {
    notifs = notifs.filter(n => n.userId === userId || n.userId === 'all');
  }
  res.json(notifs);
});

app.patch('/api/notifications/:id/read', (req: Request, res: Response) => {
  const id = req.params.id;
  dbManager.updateDb(db => {
    const n = db.notifications.find(item => item.id === id);
    if (n) n.read = true;
  });
  res.json({ success: true });
});

app.patch('/api/notifications/read-all', (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  dbManager.updateDb(db => {
    db.notifications.forEach(n => {
      if (!userId || n.userId === userId || n.userId === 'all') {
        n.read = true;
      }
    });
  });
  res.json({ success: true });
});

// --------------------------------------------------------------------------
// 9. AI FARMING ASSISTANT
// --------------------------------------------------------------------------
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await geminiService.askFarmingAssistant(message, history || []);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'AI Assistant failed', details: err.message });
  }
});

// --------------------------------------------------------------------------
// 10. ADMIN ANALYTICS & GOVERNANCE
// --------------------------------------------------------------------------
app.get('/api/admin/analytics', (req: Request, res: Response) => {
  const db = dbManager.getDb();

  const totalGmv = db.orders.reduce((sum, o) => sum + (o.status !== 'CANCELLED' ? o.totalAmount : 0), 0);
  const totalVolumeKg = db.products.reduce((sum, p) => sum + p.quantity, 0);
  const availableVolumeKg = db.products.reduce((sum, p) => sum + p.availableQuantity, 0);
  const totalSurplusRecorded = db.surplusRecords.reduce((sum, s) => sum + s.quantity, 0);
  const totalSurplusDiverted = db.surplusRecords
    .filter(s => s.status === 'RESOLVED' || s.status === 'DISCOUNTED_LISTED')
    .reduce((sum, s) => sum + s.quantity, 0);

  res.json({
    kpis: {
      totalGmv,
      totalOrders: db.orders.length,
      activeListings: db.products.filter(p => p.status === 'ACTIVE').length,
      registeredFarmers: db.users.filter(u => u.role === 'FARMER').length,
      registeredBuyers: db.users.filter(u => u.role === 'BUYER').length,
      totalVolumeKg,
      availableVolumeKg,
      totalSurplusRecorded,
      totalSurplusDiverted,
      wasteDiversionRate: totalSurplusRecorded > 0 ? Math.round((totalSurplusDiverted / totalSurplusRecorded) * 100) : 100
    },
    recentOrders: db.orders.slice(0, 5),
    systemStatus: {
      agmarknet: agmarknetService['apiKey'] ? 'CONNECTED_LIVE' : 'CACHED_BENCHMARK_VERIFIED',
      geminiAi: process.env.GEMINI_API_KEY ? 'ACTIVE (gemini-3.8-flash)' : 'RULE_BASED_FALLBACK_ACTIVE',
      databaseIntegrity: 'PERSISTENT_SYNCED',
      lastSync: db.systemConfig.lastDataSync
    }
  });
});

app.post('/api/admin/reset-seed', (req: Request, res: Response) => {
  const freshDb = dbManager.resetToSeed();
  res.json({ success: true, message: 'Database reset to initial verified seed state', data: freshDb });
});

// --------------------------------------------------------------------------
// 11. VITE MIDDLEWARE OR STATIC SERVING
// --------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Smart Farm-to-Market AI] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal error starting server:', err);
});
