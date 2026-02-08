"""
Management command to import phone data from CSV.
"""

import csv
import os
from django.core.management.base import BaseCommand
from django.conf import settings
from api.models import Phone


class Command(BaseCommand):
    help = 'Import phone data from CSV file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--csv',
            type=str,
            default=str(settings.CSV_PATH),
            help='Path to CSV file'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before import'
        )

    def handle(self, *args, **options):
        csv_path = options['csv']
        
        if not os.path.exists(csv_path):
            self.stderr.write(self.style.ERROR(f'CSV file not found: {csv_path}'))
            return
        
        if options['clear']:
            self.stdout.write('Clearing existing phone data...')
            Phone.objects.all().delete()
        
        self.stdout.write(f'Importing phones from {csv_path}...')
        
        imported = 0
        errors = 0
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                try:
                    phone = Phone(
                        company_name=self._clean_string(row.get('Company Name', '')),
                        model_name=self._clean_string(row.get('Model Name', '')),
                        processor=self._clean_string(row.get('Processor', '')),
                        launched_year=self._parse_int(row.get('Launched Year')),
                        user_rating=self._parse_float(row.get('User Rating.1', 0)),
                        user_review=self._clean_string(row.get('User Review.1', '')),
                        camera_rating=self._parse_float(row.get('User Camera Rating', 0)),
                        battery_rating=self._parse_float(row.get('User Battery Life Rating', 0)),
                        design_rating=self._parse_float(row.get('User Design Rating', 0)),
                        display_rating=self._parse_float(row.get('User Display Rating', 0)),
                        performance_rating=self._parse_float(row.get('User Performance Rating', 0)),
                        memory_gb=self._parse_int(row.get('Memory (GB)', 0)),
                        weight_g=self._parse_float(row.get('Mobile Weight (g)')),
                        ram_gb=self._parse_float(row.get('RAM (GB)', 0)),
                        front_camera_mp=self._parse_float(row.get('Front Camera (MP)', 0)),
                        back_camera_mp=self._parse_float(row.get('Back Camera (MP)', 0)),
                        battery_mah=self._parse_int(row.get('Battery Capacity (mAh)', 0)),
                        price_inr=self._parse_int(row.get('Launched Price (INR)', 0)),
                        screen_size=self._parse_float(row.get('Screen Size (inches)', 0)),
                    )
                    phone.save()
                    imported += 1
                    
                    if imported % 50 == 0:
                        self.stdout.write(f'Imported {imported} phones...')
                        
                except Exception as e:
                    errors += 1
                    self.stderr.write(
                        self.style.WARNING(f'Error importing row: {e}')
                    )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Import complete: {imported} phones imported, {errors} errors'
            )
        )
    
    def _clean_string(self, value):
        """Clean and normalize string values."""
        if value is None:
            return ''
        return str(value).strip()
    
    def _parse_int(self, value):
        """Parse integer value, return None if invalid."""
        if value is None or value == '':
            return None
        try:
            # Remove commas and parse
            return int(str(value).replace(',', '').strip())
        except (ValueError, TypeError):
            return None
    
    def _parse_float(self, value):
        """Parse float value, return 0 if invalid."""
        if value is None or value == '':
            return 0.0
        try:
            return float(str(value).replace(',', '').strip())
        except (ValueError, TypeError):
            return 0.0
