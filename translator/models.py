from django.conf import settings
from django.db import models


class LearnedSign(models.Model):
    """Learning progress only: which signs a user has practised correctly."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="learned_signs")
    sign_id = models.CharField(max_length=32)
    correct_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "sign_id"], name="unique_user_sign")]

    def __str__(self):
        return f"{self.user} · {self.sign_id}"
