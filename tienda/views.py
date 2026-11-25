from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Categoria, Producto, Pedido
from .serializers import CategoriaSerializer, ProductoSerializer, PedidoSerializer

class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer

class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.all().order_by('id')
    serializer_class = ProductoSerializer

    @action(detail=False, methods=['get'])
    def promociones(self, request):
        prods = Producto.objects.filter(descuento_porcentaje__gt=0, stock__gt=0).order_by('-descuento_porcentaje')
        serializer = self.get_serializer(prods, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def recomendados(self, request):
        cat_id = request.query_params.get('categoria')
        excluir_ids = request.query_params.get('excluir', '')
        qs = Producto.objects.filter(stock__gt=0)
        if excluir_ids:
            ids = [int(x) for x in excluir_ids.split(',') if x.isdigit()]
            if ids:
                qs = qs.exclude(id__in=ids)
        if cat_id and cat_id != 'TODAS':
            qs = qs.filter(categoria_id=cat_id)
        else:
            qs = qs.filter(destacado=True)
        serializer = self.get_serializer(qs[:4], many=True)
        return Response(serializer.data)

class PedidoViewSet(viewsets.ModelViewSet):
    queryset = Pedido.objects.all().order_by('-fecha')
    serializer_class = PedidoSerializer