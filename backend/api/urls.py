"""
API URL routing for MobiAdvisor.
"""

from django.urls import path
from .views import (
    ChatView,
    CompareView,
    PhoneListView,
    PhoneDetailView,
    FiltersView,
    BuildIndexView,
)

urlpatterns = [
    path('chat/', ChatView.as_view(), name='chat'),
    path('compare/', CompareView.as_view(), name='compare'),
    path('phones/', PhoneListView.as_view(), name='phone-list'),
    path('phones/<int:pk>/', PhoneDetailView.as_view(), name='phone-detail'),
    path('filters/', FiltersView.as_view(), name='filters'),
    path('admin/build-index/', BuildIndexView.as_view(), name='build-index'),
]
