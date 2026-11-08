from django.contrib.auth.models import User
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class UserProfile(models.Model):
    """Extends the built-in User with profile preferences and history linkage.

    Deliberately small: only what a sign-translator app needs. No camera frames
    or video are stored here.
    """

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="profile"
    )
    bio = models.CharField(
        max_length=280,
        blank=True,
        help_text="Short personal note shown on the profile page.",
    )
    accent_color = models.CharField(
        max_length=7,
        default="#b6ff3c",
        help_text="Neon accent colour (hex, e.g. #b6ff3c).",
    )
    auto_speak = models.BooleanField(
        default=True,
        help_text="Speak the recognised sign aloud automatically.",
    )
    auto_append = models.BooleanField(
        default=True,
        help_text="Add every recognised sign to the sentence automatically.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "profile"
        verbose_name_plural = "profiles"
        ordering = ["user__username"]

    def __str__(self):
        return f"{self.user.username} profile"


class Gesture(models.Model):
    """Definition of a single ISL gesture available in the dictionary.

    ``is_supported`` marks a gesture that has a trained recogniser behind it.
    ``is_demo`` marks a two-handed or otherwise non-visible placeholder sign
    that cannot realistically be recognised from a single-hand camera view.
    """

    slug = models.SlugField(
        max_length=50,
        unique=True,
        help_text="Short machine-readable identifier, e.g. \"hello\".",
    )
    name = models.CharField(
        max_length=60,
        help_text="Short, readable name of the sign.",
    )
    meaning = models.CharField(
        max_length=120,
        help_text="What the sign means in English.",
    )
    description = models.TextField(
        blank=True,
        help_text="How to form the sign, in plain language.",
    )
    example = models.CharField(
        max_length=160,
        blank=True,
        help_text="A short sentence showing the sign in context.",
    )
    category = models.CharField(
        max_length=40,
        blank=True,
        help_text="Group for filtering, e.g. \"greetings\", \"numbers\".",
    )
    is_supported = models.BooleanField(
        default=False,
        help_text="If false, no trained recogniser exists yet.",
    )
    is_demo = models.BooleanField(
        default=False,
        help_text="If true, this is a placeholder sign only; not publicly "
                  "listed as a live recogniser.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "gesture"
        verbose_name_plural = "gestures"
        ordering = ["category", "name"]

    def __str__(self):
        return f"{self.name} ({self.slug})"


class RecognitionHistory(models.Model):
    """One recorded recognition per user per gesture for history and analytics."""

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="recognition_history"
    )
    gesture = models.ForeignKey(
        Gesture,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="history",
    )
    label = models.CharField(
        max_length=60,
        help_text="Recognised sign label returned by the recogniser.",
    )
    confidence = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        default=0.0,
        help_text="Confidence score between 0.0 and 1.0.",
    )
    device = models.CharField(
        max_length=32,
        blank=True,
        help_text="Browser / OS the recognition ran on.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "recognition history"
        verbose_name_plural = "recognition history"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.label} ({self.confidence:.2f}) at {self.created_at:%Y-%m-%d %H:%M}"
