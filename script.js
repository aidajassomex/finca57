// Catálogo → carrito → WhatsApp (versión robusta)
const state = {
  products: [],
  cart: {}, // id -> {qty, product}
  shippingFlat: 0
};

const peso = (v) => (v ?? 0).toLocaleString('es-MX', {style:'currency', currency:'MXN'});

async function loadProducts(){
  try{
    const res = await fetch('products.json', {cache: 'no-cache'});
    if(!res.ok) throw new Error('No se encontró products.json');
    const data = await res.json();
    state.products = Array.isArray(data.products) ? data.products : [];
    state.shippingFlat = Number(data.shipping_flat || 0);
    // categories
    const cats = Array.from(new Set(state.products.map(p=>p.category).filter(Boolean))).sort();
    const sel = document.querySelector('#category');
    sel.innerHTML = '<option value="">Todas las categorías</option>';
    cats.forEach(c=> {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
    renderGrid();
  }catch(err){
    console.error('[loadProducts]', err);
    const grid = document.querySelector('#grid');
    if(grid){
      grid.innerHTML = `<div style="grid-column:1/-1;padding:16px;border:1px dashed #444;border-radius:12px">
        No se pudo cargar el catálogo (<code>products.json</code>). Asegúrate de que el archivo exista en la misma carpeta que <code>index.html</code> y que su contenido sea JSON válido.
      </div>`;
    }
  }
}

function renderGrid(){
  const grid = document.querySelector('#grid');
  if(!grid) return;
  const q = (document.querySelector('#search')?.value || '').toLowerCase().trim();
  const cat = document.querySelector('#category')?.value || '';
  const sort = document.querySelector('#sort')?.value || 'featured';

  let list = state.products.filter(p=> {
    const matchQ = !q || [p.name, p.description, (p.tags||[]).join(' ')].join(' ').toLowerCase().includes(q);
    const matchC = !cat || p.category === cat;
    return matchQ && matchC;
  });

  if (sort === 'price-asc') list.sort((a,b)=> (a.price||0) - (b.price||0));
  if (sort === 'price-desc') list.sort((a,b)=> (b.price||0) - (a.price||0));

  grid.innerHTML='';
  if (!list.length){
    grid.innerHTML = '<p style="grid-column:1/-1;opacity:.7">No hay productos que coincidan.</p>';
    return;
  }

  list.forEach(p=>{
    const el = document.createElement('article');
    el.className = 'card';
    const imgHtml = p.image
      ? `<img alt="${p.name}" src="${p.image}" style="width:100%;height:100%;object-fit:cover">`
      : 'Imagen';
    el.innerHTML = `
      <div class="img">${imgHtml}</div>
      <h4>${p.name}</h4>
      <p>${p.description || ''}</p>
      <div class="price">
        ${p.category ? `<span class="badge">${p.category}</span>` : ''}
        <strong>${peso(p.price)}</strong>
        ${p.unit ? `<span class="badge">${p.unit}</span>`:''}
      </div>
      <div class="add">
        <button data-id="${p.id}">Agregar</button>
      </div>
    `;
    el.querySelector('button').addEventListener('click', ()=> addToCart(p.id));
    grid.appendChild(el);
  });
  updateCartTotalsOnly();
}

function addToCart(id){
  const p = state.products.find(x=>x.id===id);
  if(!p) return;
  const item = state.cart[id] || {qty:0, product:p};
  item.qty += 1;
  state.cart[id] = item;
  updateCart();
  openCart();
}

function removeFromCart(id){
  delete state.cart[id];
  updateCart();
}

function updateCartTotalsOnly(){
  const count = Object.values(state.cart).reduce((n, it)=> n + it.qty, 0);
  const subtotal = Object.values(state.cart).reduce((n, it)=> n + (it.qty * (it.product.price || 0)), 0);
  const shipping = count > 0 ? state.shippingFlat : 0;
  const total = subtotal + shipping;
  const cc = document.querySelector('#cart-count');
  if (cc) cc.textContent = count;
  const elSub = document.querySelector('#subtotal');
  const elShip = document.querySelector('#shipping');
  const elTotal = document.querySelector('#total');
  if (elSub) elSub.textContent = peso(subtotal);
  if (elShip) elShip.textContent = peso(shipping);
  if (elTotal) elTotal.textContent = peso(total);
}

function updateCart(){
  const items = document.querySelector('#cart-items');
  if(!items) return;
  items.innerHTML = '';
  Object.values(state.cart).forEach(({qty, product})=>{
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div><strong>${product.name}</strong><br><span style="color:#888">${product.unit||''}</span></div>
      <div>${qty} × ${peso(product.price)}</div>
      <button aria-label="Quitar" data-id="${product.id}">🗑</button>
    `;
    row.querySelector('button').addEventListener('click', ()=> removeFromCart(product.id));
    items.appendChild(row);
  });
  updateCartTotalsOnly();
}

function openCart(){ document.querySelector('#cart')?.setAttribute('aria-hidden','false'); }
function closeCart(){ document.querySelector('#cart')?.setAttribute('aria-hidden','true'); }

function buildWhatsAppMessage(){
  const lines = [];
  lines.push('Hola, quiero hacer este pedido:');
  Object.values(state.cart).forEach(({qty, product})=> {
    const line = `• ${product.name} × ${qty} — ${peso((product.price||0) * qty)}`;
    lines.push(line);
  });
  const subtotal = Object.values(state.cart).reduce((n, it)=> n + it.qty * (it.product.price||0), 0);
  const shipping = Object.keys(state.cart).length ? state.shippingFlat : 0;
  const total = subtotal + shipping;
  lines.push(`Subtotal: ${peso(subtotal)}`);
  if (shipping){ lines.push(`Envío estimado: ${peso(shipping)}`); }
  lines.push(`Total: ${peso(total)}`);
  lines.push('Nombre:');
  lines.push('Dirección de envío:');
  lines.push('Método de pago preferido (transferencia / tarjeta / efectivo):');
  return encodeURIComponent(lines.join('\n'));
}

function checkoutWhatsApp(){
  if (!Object.keys(state.cart).length){
    alert('Tu carrito está vacío.');
    return;
  }
  const phone = window.WHATSAPP_NUMBER || '+5215512345678';
  const url = `https://wa.me/${phone.replace(/[^\d]/g,'')}?text=${buildWhatsAppMessage()}`;
  window.open(url, '_blank');
}

document.addEventListener('DOMContentLoaded', ()=>{
  // Listeners básicos
  document.querySelector('#search')?.addEventListener('input', renderGrid);
  document.querySelector('#category')?.addEventListener('change', renderGrid);
  document.querySelector('#sort')?.addEventListener('change', renderGrid);
  document.querySelector('#open-cart')?.addEventListener('click', openCart);
  document.querySelector('#close-cart')?.addEventListener('click', closeCart);
  document.querySelector('#checkout-wa')?.addEventListener('click', checkoutWhatsApp);

  // Scroll suave al catálogo
  const cta = document.querySelector('a[href="#catalogo"]');
  cta?.addEventListener('click', (e)=>{
    e.preventDefault();
    document.querySelector('#catalogo')?.scrollIntoView({behavior:'smooth'});
  });

  // WhatsApp directo del hero
  const waDirect = document.querySelector('#whatsapp-direct');
  if (waDirect){
    const phone = window.WHATSAPP_NUMBER || '+5215512345678';
    waDirect.href = `https://wa.me/${phone.replace(/[^\d]/g,'')}`;
  }

  loadProducts();
});
