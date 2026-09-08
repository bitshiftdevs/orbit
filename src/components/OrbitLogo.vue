<template>
	<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
		<!-- orbital ring, tilted -30° -->
		<ellipse
			cx="14" cy="14" rx="11" ry="4.8"
			stroke="white" stroke-width="1.6" fill="none"
			transform="rotate(-30 14 14)"
		/>
		<!-- planet -->
		<circle cx="14" cy="14" r="4" fill="white" />
		<!-- satellite at rightmost point of the rotated ellipse -->
		<circle cx="23.5" cy="8.5" r="1.6" fill="rgba(255,255,255,0.75)" />
	</svg>
</template>
