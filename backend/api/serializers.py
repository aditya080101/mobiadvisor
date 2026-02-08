"""
Serializers for API responses.
"""

from rest_framework import serializers
from .models import Phone


class PhoneSerializer(serializers.ModelSerializer):
    """Serializer for Phone model."""
    
    class Meta:
        model = Phone
        fields = '__all__'


class ChatRequestSerializer(serializers.Serializer):
    """Serializer for chat requests."""
    query = serializers.CharField(required=True, max_length=2000)
    filters = serializers.DictField(required=False, default=dict)
    history = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list
    )


class ChatResponseSerializer(serializers.Serializer):
    """Serializer for chat responses."""
    message = serializers.CharField()
    phones = PhoneSerializer(many=True, required=False)
    error = serializers.CharField(required=False)
    warning = serializers.CharField(required=False)


class CompareRequestSerializer(serializers.Serializer):
    """Serializer for comparison requests."""
    phones = serializers.ListField(
        child=serializers.DictField(),
        required=True,
        min_length=2,
        max_length=4
    )


class FiltersMetadataSerializer(serializers.Serializer):
    """Serializer for filter metadata response."""
    companies = serializers.ListField(child=serializers.CharField())
    priceRange = serializers.DictField()
    cameraRange = serializers.DictField()
    batteryRange = serializers.DictField()
    ramRange = serializers.DictField()
    storageRange = serializers.DictField()
