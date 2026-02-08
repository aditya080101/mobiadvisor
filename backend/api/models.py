"""
Phone model for MobiAdvisor database.
"""

from django.db import models


class Phone(models.Model):
    """
    Phone model representing mobile phone specifications and ratings.
    """
    company_name = models.CharField(max_length=100)
    model_name = models.CharField(max_length=200)
    processor = models.CharField(max_length=200, blank=True, default='')
    launched_year = models.IntegerField(null=True, blank=True)
    user_rating = models.FloatField(default=0)
    user_review = models.TextField(blank=True, default='')
    camera_rating = models.FloatField(default=0)
    battery_rating = models.FloatField(default=0)
    design_rating = models.FloatField(default=0)
    display_rating = models.FloatField(default=0)
    performance_rating = models.FloatField(default=0)
    memory_gb = models.IntegerField(default=0)
    weight_g = models.FloatField(null=True, blank=True)
    ram_gb = models.FloatField(default=0)
    front_camera_mp = models.FloatField(default=0)
    back_camera_mp = models.FloatField(default=0)
    battery_mah = models.IntegerField(default=0)
    price_inr = models.IntegerField(default=0)
    screen_size = models.FloatField(default=0)

    class Meta:
        db_table = 'phones'
        ordering = ['-user_rating']

    def __str__(self):
        return f"{self.company_name} {self.model_name}"

    def to_dict(self):
        """Convert model instance to dictionary for API responses."""
        return {
            'id': self.id,
            'company_name': self.company_name,
            'model_name': self.model_name,
            'processor': self.processor,
            'launched_year': self.launched_year,
            'user_rating': self.user_rating,
            'user_review': self.user_review,
            'camera_rating': self.camera_rating,
            'battery_rating': self.battery_rating,
            'design_rating': self.design_rating,
            'display_rating': self.display_rating,
            'performance_rating': self.performance_rating,
            'memory_gb': self.memory_gb,
            'weight_g': self.weight_g,
            'ram_gb': self.ram_gb,
            'front_camera_mp': self.front_camera_mp,
            'back_camera_mp': self.back_camera_mp,
            'battery_mah': self.battery_mah,
            'price_inr': self.price_inr,
            'screen_size': self.screen_size,
        }
