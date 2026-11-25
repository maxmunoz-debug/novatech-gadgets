from rest_framework import serializers
from .models import Categoria, Producto, Pedido, DetallePedido

class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = '__all__'

class ProductoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.ReadOnlyField(source='categoria.nombre')
    precio_final = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = ['id', 'categoria', 'categoria_nombre', 'nombre', 'descripcion', 'precio', 'precio_final', 'stock', 'imagen_url', 'destacado', 'descuento_porcentaje']

    def get_precio_final(self, obj):
        if obj.descuento_porcentaje and obj.descuento_porcentaje > 0:
            factor = (100 - obj.descuento_porcentaje) / 100
            return round(float(obj.precio) * factor, 2)
        return float(obj.precio)

class DetallePedidoInputSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)

class PedidoSerializer(serializers.ModelSerializer):    
    items = DetallePedidoInputSerializer(many=True, write_only=True)

    class Meta:
        model = Pedido
        fields = ['id', 'cliente_nombre', 'cliente_email', 'direccion', 'total', 'fecha', 'items']
        read_only_fields = ['total', 'fecha']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        total_pedido = 0

        # Validar stock antes de crear el pedido
        for item in items_data:
            producto = Producto.objects.get(id=item['producto_id'])
            if producto.stock < item['cantidad']:
                raise serializers.ValidationError(f"Stock insuficiente para {producto.nombre}. Disponible: {producto.stock}")
            total_pedido += producto.precio * item['cantidad']

        pedido = Pedido.objects.create(total=total_pedido, **validated_data)

        # Crear detalles y descontar stock
        for item in items_data:
            producto = Producto.objects.get(id=item['producto_id'])
            subtotal = producto.precio * item['cantidad']
            DetallePedido.objects.create(
                pedido=pedido,
                producto=producto,
                cantidad=item['cantidad'],
                subtotal=subtotal
            )
            producto.stock -= item['cantidad']
            producto.save()

        return pedido