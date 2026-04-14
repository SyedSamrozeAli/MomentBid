from django.db import models


class Match(models.Model):
	class State(models.IntegerChoices):
		CREATED = 0, "Created"
		OPEN = 1, "Open"
		ACTIVE = 2, "Active"
		COMPLETED = 3, "Completed"
		CANCELLED = 4, "Cancelled"

	on_chain_match_id = models.PositiveIntegerField(unique=True, null=True, blank=True)
	broadcaster = models.ForeignKey(
		"accounts.Broadcaster",
		on_delete=models.CASCADE,
		related_name="matches",
	)
	team_a = models.CharField(max_length=100)
	team_b = models.CharField(max_length=100)
	venue = models.CharField(max_length=200)
	match_date = models.DateTimeField()
	state = models.IntegerField(choices=State.choices, default=State.CREATED)
	create_tx_hash = models.CharField(max_length=66, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
    

	class Meta:
		ordering = ["-created_at"]

	def __str__(self) -> str:
		return f"{self.team_a} vs {self.team_b}"


class MatchEventConfig(models.Model):
	class EventType(models.IntegerChoices):
		OVER_BREAK = 0, "Over Break"
		STRATEGIC_TIMEOUT = 1, "Strategic Timeout"
		INNINGS_BREAK = 2, "Innings Break"
		WICKET_FALL = 3, "Wicket Fall"
		HIGH_VALUE_WICKET = 4, "High Value Wicket"
		LAST_OVER_THRILLER = 5, "Last Over Thriller"
		HAT_TRICK_BALL = 6, "Hat Trick Ball"
		SUPER_OVER = 7, "Super Over"

	match = models.ForeignKey(
		Match,
		on_delete=models.CASCADE,
		related_name="event_configs",
	)
	event_type = models.IntegerField(choices=EventType.choices)
	reserve_price = models.DecimalField(max_digits=15, decimal_places=2)
	reservation_fee_pct = models.DecimalField(max_digits=4, decimal_places=2)
	slot_count = models.PositiveSmallIntegerField(default=3)
	max_triggers = models.PositiveSmallIntegerField(default=40)
	trigger_count = models.PositiveSmallIntegerField(default=0)

	class Meta:
		unique_together = ("match", "event_type")

	def __str__(self) -> str:
		return f"EventConfig<{self.match_id}:{self.event_type}>"


class ExclusionGroup(models.Model):
	on_chain_group_id = models.PositiveIntegerField(unique=True, null=True, blank=True)
	name = models.CharField(max_length=100)
	separation_distance = models.PositiveSmallIntegerField(default=1)
	cross_event_separation = models.BooleanField(default=False)
	is_locked = models.BooleanField(default=False)
	broadcaster = models.ForeignKey(
		"accounts.Broadcaster",
		on_delete=models.CASCADE,
		related_name="exclusion_groups",
	)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self) -> str:
		return self.name


class ExclusionGroupMember(models.Model):
	group = models.ForeignKey(
		ExclusionGroup,
		on_delete=models.CASCADE,
		related_name="members",
	)
	brand = models.ForeignKey(
		"accounts.Brand",
		on_delete=models.CASCADE,
		related_name="exclusion_memberships",
	)

	class Meta:
		unique_together = ("group", "brand")

	def __str__(self) -> str:
		return f"{self.group_id}:{self.brand_id}"
