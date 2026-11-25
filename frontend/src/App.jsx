import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

export default function App() {
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [recomendados, setRecomendados] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState('TODAS')
  const [busqueda, setBusqueda] = useState('')
  const [soloOfertas, setSoloOfertas] = useState(false)
  const [carrito, setCarrito] = useState([])
  const [vista, setVista] = useState('tienda') // 'tienda' | 'inventario' | 'carrito'
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState(null)

  // Cupones promocionales (Marketing)
  const [codigoCupon, setCodigoCupon] = useState('')
  const [cuponAplicado, setCuponAplicado] = useState(null) // { codigo: 'NOVATECH10', descuento: 10 }

  // Formulario de Checkout
  const [cliente, setCliente] = useState({
    cliente_nombre: '',
    cliente_email: '',
    direccion: ''
  })

  // Formulario de Nuevo Producto (Inventario)
  const [nuevoProd, setNuevoProd] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    stock: 10,
    descuento_porcentaje: 0,
    categoria: '',
    imagen_url: ''
  })

  const obtenerPrecioFinal = (prod) => {
    const base = Number(prod.precio)
    const desc = Number(prod.descuento_porcentaje || 0)
    if (desc > 0) {
      return Number((base * (100 - desc)) / 100)
    }
    return base
  }

  const cargarDatos = async () => {
    try {
      setCargando(true)
      const [resCat, resProd] = await Promise.all([
        axios.get(`${API_URL}/categorias/`),
        axios.get(`${API_URL}/productos/`)
      ])
      setCategorias(resCat.data)
      setProductos(resProd.data)
      if (resCat.data.length > 0 && !nuevoProd.categoria) {
        setNuevoProd((prev) => ({ ...prev, categoria: resCat.data[0].id }))
      }
    } catch (error) {
      console.error('Error conectando con el backend:', error)
      mostrarAlerta('No se pudo conectar con el servidor Backend.', 'danger')
    } finally {
      setCargando(false)
    }
  }

  // Cargar recomendaciones inteligentes desde el endpoint del Backend
  const cargarRecomendados = async (catId, itemsCarrito) => {
    try {
      const idsEnCarrito = itemsCarrito.map((i) => i.id).join(',')
      const catParam =
        catId !== 'TODAS'
          ? catId
          : itemsCarrito.length > 0
            ? itemsCarrito[itemsCarrito.length - 1].categoria
            : 'TODAS'
      const res = await axios.get(
        `${API_URL}/productos/recomendados/?categoria=${catParam}&excluir=${idsEnCarrito}`
      )
      setRecomendados(res.data)
    } catch {
      // Fallback local si el endpoint no responde
      const idsCarrito = new Set(itemsCarrito.map((i) => i.id))
      const filtrados = productos
        .filter((p) => p.stock > 0 && !idsCarrito.has(p.id))
        .filter((p) => (catId !== 'TODAS' ? p.categoria === Number(catId) : p.destacado))
        .slice(0, 4)
      setRecomendados(filtrados)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (productos.length > 0) {
      cargarRecomendados(categoriaActiva, carrito)
    }
  }, [categoriaActiva, carrito, productos])

  const mostrarAlerta = (texto, tipo = 'info') => {
    setMensaje({ texto, tipo })
    setTimeout(() => setMensaje(null), 4500)
  }

  // Filtrado de productos por categoría, búsqueda y filtro de ofertas
  const productosFiltrados = productos.filter((p) => {
    const coincideCategoria =
      categoriaActiva === 'TODAS' || p.categoria === Number(categoriaActiva)
    const coincideBusqueda =
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.descripcion.toLowerCase().includes(busqueda.toLowerCase())
    const coincideOferta = !soloOfertas || Number(p.descuento_porcentaje || 0) > 0
    return coincideCategoria && coincideBusqueda && coincideOferta
  })

  const totalProductosEnOferta = productos.filter(
    (p) => Number(p.descuento_porcentaje || 0) > 0
  ).length

  // Funciones del Carrito
  const agregarAlCarrito = (producto) => {
    const itemExistente = carrito.find((item) => item.id === producto.id)
    const cantidadActual = itemExistente ? itemExistente.cantidad : 0

    if (cantidadActual + 1 > producto.stock) {
      mostrarAlerta(`No hay más stock disponible de ${producto.nombre} (Máx: ${producto.stock})`, 'warning')
      return
    }

    if (itemExistente) {
      setCarrito(
        carrito.map((item) =>
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        )
      )
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1 }])
    }
    mostrarAlerta(`${producto.nombre} agregado al carrito`, 'success')
  }

  const cambiarCantidadCarrito = (id, delta) => {
    const prodOriginal = productos.find((p) => p.id === id)
    setCarrito(
      carrito
        .map((item) => {
          if (item.id === id) {
            const nuevaCant = item.cantidad + delta
            if (prodOriginal && nuevaCant > prodOriginal.stock) {
              mostrarAlerta(`Stock máximo alcanzado (${prodOriginal.stock} uds.)`, 'warning')
              return item
            }
            return { ...item, cantidad: nuevaCant }
          }
          return item
        })
        .filter((item) => item.cantidad > 0)
    )
  }

  // Aplicar Cupón Promocional
  const aplicarCupon = (e) => {
    e.preventDefault()
    const limpio = codigoCupon.trim().toUpperCase()
    const cuponesValidos = {
      NOVATECH10: 10,
      CYBER15: 15,
      VIP20: 20
    }
    if (cuponesValidos[limpio]) {
      setCuponAplicado({ codigo: limpio, porcentaje: cuponesValidos[limpio] })
      mostrarAlerta(`¡Cupón ${limpio} aplicado! Tienes ${cuponesValidos[limpio]}% de descuento adicional.`, 'success')
    } else {
      mostrarAlerta('Cupón no válido. Prueba con NOVATECH10 o CYBER15.', 'warning')
    }
  }

  const subtotalOriginal = carrito.reduce(
    (acc, item) => acc + Number(item.precio) * item.cantidad,
    0
  )

  const subtotalConOfertas = carrito.reduce(
    (acc, item) => acc + obtenerPrecioFinal(item) * item.cantidad,
    0
  )

  const ahorroPorOfertas = subtotalOriginal - subtotalConOfertas
  const descuentoCuponMonto = cuponAplicado
    ? (subtotalConOfertas * cuponAplicado.porcentaje) / 100
    : 0
  const totalCarrito = Math.max(0, subtotalConOfertas - descuentoCuponMonto)

  const cantidadTotalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0)

  // Confirmar Pedido (POST /api/pedidos/)
  const confirmarCompra = async (e) => {
    e.preventDefault()
    if (carrito.length === 0) return

    try {
      const payload = {
        cliente_nombre: cliente.cliente_nombre,
        cliente_email: cliente.cliente_email,
        direccion: cliente.direccion,
        items: carrito.map((item) => ({
          producto_id: item.id,
          cantidad: item.cantidad
        }))
      }

      const res = await axios.post(`${API_URL}/pedidos/`, payload)
      mostrarAlerta(`¡Pedido #${res.data.id} registrado con éxito! El stock ha sido actualizado.`, 'success')
      setCarrito([])
      setCuponAplicado(null)
      setCodigoCupon('')
      setCliente({ cliente_nombre: '', cliente_email: '', direccion: '' })
      setVista('tienda')
      cargarDatos()
    } catch (error) {
      console.error(error)
      mostrarAlerta('Error al procesar el pedido. Verifica el stock disponible.', 'danger')
    }
  }

  // Actualizar Stock o Descuento en Inventario (PATCH /api/productos/{id}/)
  const actualizarStock = async (producto, nuevoStock) => {
    if (nuevoStock < 0) return
    try {
      await axios.patch(`${API_URL}/productos/${producto.id}/`, { stock: nuevoStock })
      setProductos(
        productos.map((p) => (p.id === producto.id ? { ...p, stock: nuevoStock } : p))
      )
      mostrarAlerta(`Stock de "${producto.nombre}" actualizado a ${nuevoStock} unidades.`, 'info')
    } catch (error) {
      console.error(error)
      mostrarAlerta('No se pudo actualizar el stock.', 'danger')
    }
  }

  const actualizarDescuento = async (producto, nuevoDescuento) => {
    try {
      await axios.patch(`${API_URL}/productos/${producto.id}/`, {
        descuento_porcentaje: nuevoDescuento
      })
      setProductos(
        productos.map((p) =>
          p.id === producto.id ? { ...p, descuento_porcentaje: nuevoDescuento } : p
        )
      )
      mostrarAlerta(
        `Promoción de "${producto.nombre}" actualizada a ${nuevoDescuento}% OFF.`,
        'info'
      )
    } catch (error) {
      console.error(error)
      mostrarAlerta('No se pudo actualizar el descuento.', 'danger')
    }
  }

  // Crear Nuevo Producto (POST /api/productos/)
  const crearProducto = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`${API_URL}/productos/`, {
        ...nuevoProd,
        categoria: Number(nuevoProd.categoria),
        precio: Number(nuevoProd.precio),
        stock: Number(nuevoProd.stock),
        descuento_porcentaje: Number(nuevoProd.descuento_porcentaje || 0)
      })
      mostrarAlerta(`Gadget "${nuevoProd.nombre}" agregado al catálogo.`, 'success')
      setNuevoProd({
        nombre: '',
        descripcion: '',
        precio: '',
        stock: 10,
        descuento_porcentaje: 0,
        categoria: categorias[0]?.id || '',
        imagen_url: ''
      })
      cargarDatos()
    } catch (error) {
      console.error(error)
      mostrarAlerta('Error al crear el producto.', 'danger')
    }
  }

  return (
    <div className="min-vh-100 d-flex flex-column">
      {/* BANNER SUPERIOR DE MARKETING Y PROMOCIONES */}
      <div
        className="py-2 px-3 text-center small fw-semibold"
        style={{
          backgroundColor: '#23536F',
          color: '#F0EFEA',
          borderBottom: '1px solid #8DB5C7'
        }}
      >
        <span>
          🔥 <strong>CAMPAÑA TECH WEEK:</strong> Hasta <strong>25% OFF</strong> en gadgets seleccionados +{' '}
          <strong>10% EXTRA</strong> en tu carrito usando el cupón{' '}
          <span
            className="badge ms-1"
            style={{ backgroundColor: '#8DB5C7', color: '#0B111E', cursor: 'pointer' }}
            onClick={() => {
              setCodigoCupon('NOVATECH10')
              mostrarAlerta('Código NOVATECH10 copiado al carrito', 'info')
            }}
          >
            NOVATECH10
          </span>
        </span>
      </div>

      {/* NAVBAR CON LOGO PROPIO NOVATECH */}
      <nav className="navbar navbar-expand-lg nova-navbar sticky-top py-3">
        <div className="container">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault()
              setVista('tienda')
            }}
            className="navbar-brand d-flex align-items-center gap-3 text-decoration-none"
          >
            <svg width="42" height="42" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="48" height="48" rx="12" fill="#132B47" stroke="#8DB5C7" strokeWidth="2" />
              <path d="M14 34V14L25 28V14" stroke="#F0EFEA" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M27 20H37M32 20V34" stroke="#8DB5C7" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="35" cy="14" r="2.5" fill="#8DB5C7" />
            </svg>
            <div>
              <span className="fw-bold fs-4 d-block lh-1" style={{ color: '#F0EFEA', letterSpacing: '0.5px' }}>
                NOVATECH <span style={{ color: '#8DB5C7' }}>GADGETS</span>
              </span>
              <small style={{ color: '#8DB5C7', fontSize: '0.72rem' }}>
                NEXT-GEN CONSUMER TECH STORE
              </small>
            </div>
          </a>

          <div className="d-flex align-items-center gap-2 ms-auto flex-wrap nova-nav-actions">
            <button
              className={`btn btn-sm px-3 py-2 ${vista === 'tienda' ? 'nova-btn-accent' : 'nova-btn-primary'}`}
              onClick={() => setVista('tienda')}
            >
              Catálogo ({productos.length})
            </button>

            <button
              className={`btn btn-sm px-3 py-2 ${vista === 'inventario' ? 'nova-btn-accent' : 'nova-btn-primary'}`}
              onClick={() => setVista('inventario')}
            >
              Inventario
            </button>

            <button
              className={`btn btn-sm px-3 py-2 position-relative ${vista === 'carrito' ? 'nova-btn-accent' : 'nova-btn-primary'}`}
              onClick={() => setVista('carrito')}
            >
              Carrito
              {cantidadTotalItems > 0 && (
                <span
                  className="badge rounded-pill ms-2"
                  style={{ backgroundColor: '#F0EFEA', color: '#0B111E' }}
                >
                  {cantidadTotalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ALERTA FLOTANTE */}
      {mensaje && (
        <div className="container mt-3">
          <div
            className="alert d-flex justify-content-between align-items-center mb-0 py-2 px-3"
            style={{
              backgroundColor: '#132B47',
              borderColor: '#8DB5C7',
              color: '#F0EFEA'
            }}
          >
            <span>{mensaje.texto}</span>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={() => setMensaje(null)}
            />
          </div>
        </div>
      )}

      {/* VISTA 1: TIENDA, PROMOCIONES Y RECOMENDACIONES */}
      {vista === 'tienda' && (
        <>
          {/* HERO BANNER */}
          <header className="nova-hero py-5 mb-4">
            <div className="container">
              <div className="row align-items-center g-4">
                <div className="col-lg-8">
                  <span
                    className="badge mb-2 px-3 py-2"
                    style={{ backgroundColor: '#23536F', color: '#F0EFEA', border: '1px solid #8DB5C7' }}
                  >
                    TECNOLOGÍA PREMIUM • ENVÍOS A TODO EL PERÚ
                  </span>
                  <h1 className="display-5 fw-bold mb-2" style={{ color: '#F0EFEA' }}>
                    Tecnología de Vanguardia con{' '}
                    <span style={{ color: '#8DB5C7' }}>NovaTech Gadgets</span>
                  </h1>
                  <p className="lead mb-0" style={{ color: '#A9C2CE' }}>
                    Explora nuestras 5 categorías especializadas con descuentos exclusivos en tiempo real
                    y recomendaciones personalizadas según tus preferencias.
                  </p>
                </div>
                <div className="col-lg-4">
                  <input
                    type="text"
                    className="form-control form-control-lg nova-input"
                    placeholder="Buscar gadget (ej. AirPods, Alexa, MagSafe)..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </header>

          <main className="container mb-5 flex-grow-1">
            {/* BARRA DE LAS 5 CATEGORÍAS + FILTRO DE PROMOCIONES */}
            <div className="d-flex flex-wrap gap-2 mb-4 align-items-center justify-content-between">
              <div className="d-flex flex-wrap gap-2 align-items-center nova-category-scroll">
                <button
                  className={`btn nova-category-pill ${categoriaActiva === 'TODAS' && !soloOfertas ? 'active' : ''}`}
                  onClick={() => {
                    setCategoriaActiva('TODAS')
                    setSoloOfertas(false)
                  }}
                >
                  Todas las Categorías ({productos.length})
                </button>
                {categorias.map((cat) => {
                  const cuenta = productos.filter((p) => p.categoria === cat.id).length
                  return (
                    <button
                      key={cat.id}
                      className={`btn nova-category-pill ${Number(categoriaActiva) === cat.id ? 'active' : ''}`}
                      onClick={() => setCategoriaActiva(cat.id)}
                    >
                      {cat.nombre} ({cuenta})
                    </button>
                  )
                })}
              </div>

              <button
                className={`btn nova-category-pill ${soloOfertas ? 'active' : ''}`}
                style={{
                  borderColor: '#8DB5C7',
                  backgroundColor: soloOfertas ? '#8DB5C7' : '#23536F',
                  color: soloOfertas ? '#0B111E' : '#F0EFEA'
                }}
                onClick={() => setSoloOfertas(!soloOfertas)}
              >
                🔥 Ofertas Flash ({totalProductosEnOferta})
              </button>
            </div>

            {/* GRILLA DE PRODUCTOS */}
            {cargando ? (
              <div className="text-center py-5">
                <div className="spinner-border text-nova-accent mb-3" role="status" />
                <p>Cargando catálogo de NovaTech Gadgets...</p>
              </div>
            ) : (
              <div className="row g-4">
                {productosFiltrados.map((prod) => {
                  const tieneDescuento = Number(prod.descuento_porcentaje || 0) > 0
                  const precioFinal = obtenerPrecioFinal(prod)
                  return (
                    <div key={prod.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                      <div className="card nova-card h-100 d-flex flex-column overflow-hidden">
                        <div
                          className="position-relative"
                          style={{ height: '200px', backgroundColor: '#0B111E' }}
                        >
                          <img
                            src={prod.imagen_url || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500'}
                            alt={prod.nombre}
                            className="w-100 h-100"
                            style={{ objectFit: 'cover' }}
                          />
                          <span
                            className="badge position-absolute top-0 start-0 m-2"
                            style={{ backgroundColor: '#132B47', color: '#8DB5C7', border: '1px solid #23536F' }}
                          >
                            {prod.categoria_nombre}
                          </span>

                          {tieneDescuento && (
                            <span
                              className="badge position-absolute bottom-0 start-0 m-2 fw-bold"
                              style={{ backgroundColor: '#8DB5C7', color: '#0B111E' }}
                            >
                              -{prod.descuento_porcentaje}% OFF
                            </span>
                          )}

                          <span
                            className="badge position-absolute top-0 end-0 m-2"
                            style={{
                              backgroundColor:
                                prod.stock > 5 ? '#23536F' : prod.stock > 0 ? '#854D0E' : '#7F1D1D',
                              color: '#F0EFEA'
                            }}
                          >
                            {prod.stock > 0 ? `Stock: ${prod.stock}` : 'Agotado'}
                          </span>
                        </div>

                        <div className="card-body d-flex flex-column">
                          <h5 className="card-title fw-bold mb-1" style={{ color: '#F0EFEA' }}>
                            {prod.nombre}
                          </h5>
                          <p className="card-text small flex-grow-1" style={{ color: '#A9C2CE' }}>
                            {prod.descripcion}
                          </p>

                          <div
                            className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top"
                            style={{ borderColor: '#23536F' }}
                          >
                            <div>
                              {tieneDescuento ? (
                                <>
                                  <small
                                    className="d-block text-decoration-line-through"
                                    style={{ color: '#A9C2CE', fontSize: '0.75rem' }}
                                  >
                                    S/ {Number(prod.precio).toFixed(2)}
                                  </small>
                                  <span className="fs-5 fw-bold" style={{ color: '#8DB5C7' }}>
                                    S/ {precioFinal.toFixed(2)}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <small className="d-block" style={{ color: '#8DB5C7', fontSize: '0.72rem' }}>
                                    PRECIO ONLINE
                                  </small>
                                  <span className="fs-5 fw-bold" style={{ color: '#8DB5C7' }}>
                                    S/ {Number(prod.precio).toFixed(2)}
                                  </span>
                                </>
                              )}
                            </div>
                            <button
                              className="btn btn-sm nova-btn-accent px-3 py-2"
                              disabled={prod.stock === 0}
                              onClick={() => agregarAlCarrito(prod)}
                            >
                              {prod.stock > 0 ? '+ Agregar' : 'Sin Stock'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* SISTEMA DE RECOMENDACIÓN DE PRODUCTOS (CONECTADO A /api/productos/recomendados/) */}
            {recomendados.length > 0 && (
              <section className="mt-5 pt-4 border-top" style={{ borderColor: '#23536F' }}>
                <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
                  <div>
                    <span
                      className="badge mb-1"
                      style={{ backgroundColor: '#23536F', color: '#8DB5C7', border: '1px solid #8DB5C7' }}
                    >
                      SELECCIÓN PERSONALIZADA
                    </span>
                    <h4 className="fw-bold mb-0" style={{ color: '#F0EFEA' }}>
                      Recomendados para Ti{' '}
                      {categoriaActiva !== 'TODAS' &&
                        `en ${categorias.find((c) => c.id === Number(categoriaActiva))?.nombre || ''}`}
                    </h4>
                  </div>
                  <small style={{ color: '#A9C2CE' }}>
                    Los gadgets favoritos de nuestros clientes esta semana
                  </small>
                </div>

                <div className="row g-3">
                  {recomendados.map((rec) => {
                    const precioRec = obtenerPrecioFinal(rec)
                    return (
                      <div key={rec.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                        <div
                          className="p-3 rounded h-100 d-flex flex-column justify-content-between"
                          style={{ backgroundColor: '#132B47', border: '1px solid #8DB5C7' }}
                        >
                          <div className="d-flex gap-3 align-items-center mb-3">
                            <img
                              src={rec.imagen_url}
                              alt={rec.nombre}
                              style={{
                                width: '64px',
                                height: '64px',
                                objectFit: 'cover',
                                borderRadius: '10px'
                              }}
                            />
                            <div>
                              <span
                                className="badge mb-1"
                                style={{ backgroundColor: '#23536F', color: '#F0EFEA', fontSize: '0.68rem' }}
                              >
                                {rec.categoria_nombre}
                              </span>
                              <h6 className="fw-bold mb-0 small" style={{ color: '#F0EFEA' }}>
                                {rec.nombre}
                              </h6>
                            </div>
                          </div>

                          <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: '#23536F' }}>
                            <div>
                              {rec.descuento_porcentaje > 0 && (
                                <small className="text-decoration-line-through me-2" style={{ color: '#A9C2CE' }}>
                                  S/ {Number(rec.precio).toFixed(2)}
                                </small>
                              )}
                              <span className="fw-bold" style={{ color: '#8DB5C7' }}>
                                S/ {precioRec.toFixed(2)}
                              </span>
                            </div>
                            <button
                              className="btn btn-sm nova-btn-primary py-1 px-2"
                              onClick={() => agregarAlCarrito(rec)}
                            >
                              + Sumar
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </main>
        </>
      )}

      {/* VISTA 2: PANEL DE GESTIÓN DE INVENTARIOS Y PROMOCIONES */}
      {vista === 'inventario' && (
        <main className="container my-4 flex-grow-1">
          <div className="row g-4">
            <div className="col-lg-8">
              <div className="nova-card p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h4 className="fw-bold mb-0">Panel de Control de Inventario y Promociones</h4>
                  </div>
                  <span className="badge px-3 py-2" style={{ backgroundColor: '#23536F', color: '#F0EFEA' }}>
                    {productos.length} Productos Registrados
                  </span>
                </div>

                <div className="table-responsive">
                  <table className="table table-dark table-hover align-middle mb-0">
                    <thead>
                      <tr style={{ color: '#8DB5C7' }}>
                        <th>ID</th>
                        <th>Gadget</th>
                        <th>Precio</th>
                        <th>Promoción</th>
                        <th>Stock</th>
                        <th className="text-end">Ajuste Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map((p) => (
                        <tr key={p.id}>
                          <td>#{p.id}</td>
                          <td>
                            <div className="fw-semibold">{p.nombre}</div>
                            <small style={{ color: '#8DB5C7' }}>{p.categoria_nombre}</small>
                          </td>
                          <td>
                            <div>S/ {obtenerPrecioFinal(p).toFixed(2)}</div>
                            {p.descuento_porcentaje > 0 && (
                              <small className="text-decoration-line-through" style={{ color: '#A9C2CE' }}>
                                S/ {Number(p.precio).toFixed(2)}
                              </small>
                            )}
                          </td>
                          <td>
                            <select
                              className="form-select form-select-sm nova-input"
                              style={{ width: '105px' }}
                              value={p.descuento_porcentaje || 0}
                              onChange={(e) => actualizarDescuento(p, Number(e.target.value))}
                            >
                              <option value={0}>0% OFF</option>
                              <option value={10}>10% OFF</option>
                              <option value={15}>15% OFF</option>
                              <option value={20}>20% OFF</option>
                              <option value={25}>25% OFF</option>
                            </select>
                          </td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                backgroundColor: p.stock > 5 ? '#23536F' : p.stock > 0 ? '#854D0E' : '#7F1D1D',
                                color: '#F0EFEA'
                              }}
                            >
                              {p.stock} uds.
                            </span>
                          </td>
                          <td className="text-end">
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn nova-btn-primary"
                                onClick={() => actualizarStock(p, p.stock - 1)}
                                disabled={p.stock <= 0}
                              >
                                -1
                              </button>
                              <button
                                className="btn nova-btn-primary"
                                onClick={() => actualizarStock(p, p.stock + 1)}
                              >
                                +1
                              </button>
                              <button
                                className="btn nova-btn-accent"
                                onClick={() => actualizarStock(p, p.stock + 5)}
                              >
                                +5
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* FORMULARIO PARA AGREGAR NUEVO PRODUCTO */}
            <div className="col-lg-4">
              <div className="nova-card p-4">
                <h5 className="fw-bold mb-3">Registrar Nuevo Gadget</h5>

                <form onSubmit={crearProducto}>
                  <div className="mb-3">
                    <label className="form-label small">Nombre del Producto</label>
                    <input
                      type="text"
                      className="form-control nova-input"
                      required
                      value={nuevoProd.nombre}
                      onChange={(e) => setNuevoProd({ ...nuevoProd, nombre: e.target.value })}
                      placeholder="Ej. Sony WH-1000XM5"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small">Categoría</label>
                    <select
                      className="form-select nova-input"
                      value={nuevoProd.categoria}
                      onChange={(e) => setNuevoProd({ ...nuevoProd, categoria: e.target.value })}
                      required
                    >
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-4">
                      <label className="form-label small">Precio (S/)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control nova-input"
                        required
                        value={nuevoProd.precio}
                        onChange={(e) => setNuevoProd({ ...nuevoProd, precio: e.target.value })}
                        placeholder="299"
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label small">Stock</label>
                      <input
                        type="number"
                        className="form-control nova-input"
                        required
                        value={nuevoProd.stock}
                        onChange={(e) => setNuevoProd({ ...nuevoProd, stock: e.target.value })}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label small">% Desc.</label>
                      <input
                        type="number"
                        min="0"
                        max="80"
                        className="form-control nova-input"
                        value={nuevoProd.descuento_porcentaje}
                        onChange={(e) =>
                          setNuevoProd({ ...nuevoProd, descuento_porcentaje: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small">URL de Imagen</label>
                    <input
                      type="url"
                      className="form-control nova-input"
                      value={nuevoProd.imagen_url}
                      onChange={(e) => setNuevoProd({ ...nuevoProd, imagen_url: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small">Descripción</label>
                    <textarea
                      className="form-control nova-input"
                      rows="3"
                      required
                      value={nuevoProd.descripcion}
                      onChange={(e) => setNuevoProd({ ...nuevoProd, descripcion: e.target.value })}
                      placeholder="Características principales del gadget..."
                    />
                  </div>

                  <button type="submit" className="btn nova-btn-accent w-100 py-2">
                    Guardar en Inventario
                  </button>
                </form>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* VISTA 3: CARRITO DE COMPRAS, CUPONES Y CROSS-SELLING */}
      {vista === 'carrito' && (
        <main className="container my-4 flex-grow-1">
          <div className="row g-4">
            <div className="col-lg-7">
              <div className="nova-card p-4 mb-4">
                <h4 className="fw-bold mb-3">Tu Carrito de Compras</h4>
                {carrito.length === 0 ? (
                  <div className="text-center py-5">
                    <p className="mb-3" style={{ color: '#A9C2CE' }}>
                      Tu carrito está vacío actualmente.
                    </p>
                    <button className="btn nova-btn-accent" onClick={() => setVista('tienda')}>
                      Explorar Catálogo
                    </button>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {carrito.map((item) => {
                      const precioUnit = obtenerPrecioFinal(item)
                      return (
                        <div
                          key={item.id}
                          className="d-flex justify-content-between align-items-center p-3 rounded nova-cart-item"
                          style={{ backgroundColor: '#0B111E', border: '1px solid #23536F' }}
                        >
                          <div>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <h6 className="fw-bold mb-1">{item.nombre}</h6>
                              {item.descuento_porcentaje > 0 && (
                                <span
                                  className="badge"
                                  style={{ backgroundColor: '#8DB5C7', color: '#0B111E' }}
                                >
                                  -{item.descuento_porcentaje}% OFF
                                </span>
                              )}
                            </div>
                            <small style={{ color: '#8DB5C7' }}>
                              S/ {precioUnit.toFixed(2)} c/u
                            </small>
                          </div>

                          <div className="d-flex align-items-center gap-3 nova-cart-controls">
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn nova-btn-primary"
                                onClick={() => cambiarCantidadCarrito(item.id, -1)}
                              >
                                -
                              </button>
                              <span className="btn nova-btn-primary disabled">{item.cantidad}</span>
                              <button
                                className="btn nova-btn-primary"
                                onClick={() => cambiarCantidadCarrito(item.id, 1)}
                              >
                                +
                              </button>
                            </div>

                            <span
                              className="fw-bold"
                              style={{ color: '#8DB5C7', minWidth: '90px', textAlign: 'right' }}
                            >
                              S/ {(precioUnit * item.cantidad).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* RECOMENDACIONES CRUZADAS EN EL CARRITO (CROSS-SELLING) */}
              {recomendados.length > 0 && (
                <div className="nova-card p-4">
                  <h5 className="fw-bold mb-3">Frecuentemente Comprados Juntos</h5>
                  <div className="row g-3">
                    {recomendados.slice(0, 2).map((rec) => (
                      <div key={rec.id} className="col-md-6">
                        <div
                          className="p-3 rounded d-flex justify-content-between align-items-center"
                          style={{ backgroundColor: '#0B111E', border: '1px solid #23536F' }}
                        >
                          <div>
                            <h6 className="fw-bold mb-1 small">{rec.nombre}</h6>
                            <span className="fw-bold small" style={{ color: '#8DB5C7' }}>
                              S/ {obtenerPrecioFinal(rec).toFixed(2)}
                            </span>
                          </div>
                          <button
                            className="btn btn-sm nova-btn-accent"
                            onClick={() => agregarAlCarrito(rec)}
                          >
                            + Agregar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="col-lg-5">
              <div className="nova-card p-4">
                <h5 className="fw-bold mb-3">Confirmar Pedido</h5>

                {/* CUPÓN DE DESCUENTO (MARKETING) */}
                <form onSubmit={aplicarCupon} className="mb-3">
                  <label className="form-label small">Cupón Promocional</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control nova-input"
                      placeholder="Ej. NOVATECH10 o CYBER15"
                      value={codigoCupon}
                      onChange={(e) => setCodigoCupon(e.target.value)}
                    />
                    <button type="submit" className="btn nova-btn-primary">
                      Aplicar
                    </button>
                  </div>
                </form>

                <form onSubmit={confirmarCompra}>
                  <div className="mb-3">
                    <label className="form-label small">Nombre Completo</label>
                    <input
                      type="text"
                      className="form-control nova-input"
                      required
                      value={cliente.cliente_nombre}
                      onChange={(e) => setCliente({ ...cliente, cliente_nombre: e.target.value })}
                      placeholder="Ej. Max Muñoz"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small">Correo Electrónico</label>
                    <input
                      type="email"
                      className="form-control nova-input"
                      required
                      value={cliente.cliente_email}
                      onChange={(e) => setCliente({ ...cliente, cliente_email: e.target.value })}
                      placeholder="cliente@novatech.pe"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small">Dirección de Envío</label>
                    <input
                      type="text"
                      className="form-control nova-input"
                      required
                      value={cliente.direccion}
                      onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
                      placeholder="Av. Arequipa 1250, Lima"
                    />
                  </div>

                  <div
                    className="p-3 rounded mb-3"
                    style={{ backgroundColor: '#0B111E', border: '1px solid #8DB5C7' }}
                  >
                    <div className="d-flex justify-content-between small mb-1" style={{ color: '#A9C2CE' }}>
                      <span>Subtotal Catálogo:</span>
                      <span>S/ {subtotalOriginal.toFixed(2)}</span>
                    </div>
                    {ahorroPorOfertas > 0 && (
                      <div className="d-flex justify-content-between small mb-1" style={{ color: '#8DB5C7' }}>
                        <span>Descuento Ofertas Flash:</span>
                        <span>- S/ {ahorroPorOfertas.toFixed(2)}</span>
                      </div>
                    )}
                    {cuponAplicado && (
                      <div className="d-flex justify-content-between small mb-2" style={{ color: '#8DB5C7' }}>
                        <span>Cupón ({cuponAplicado.codigo} -{cuponAplicado.porcentaje}%):</span>
                        <span>- S/ {descuentoCuponMonto.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: '#23536F' }}>
                      <span className="fw-semibold">Total a Pagar:</span>
                      <span className="fs-4 fw-bold" style={{ color: '#8DB5C7' }}>
                        S/ {totalCarrito.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn nova-btn-accent w-100 py-2"
                    disabled={carrito.length === 0}
                  >
                    Finalizar Compra
                  </button>
                </form>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* FOOTER */}
      <footer className="py-4 mt-auto" style={{ backgroundColor: '#0B111E', borderTop: '1px solid #23536F' }}>
        <div className="container d-flex flex-wrap justify-content-between align-items-center small" style={{ color: '#8DB5C7' }}>
          <span>© 2026 NovaTech Gadgets. Todos los derechos reservados.</span>
        </div>
      </footer>
    </div>
  )
}
